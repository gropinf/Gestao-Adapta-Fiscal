import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authMiddleware, hashPassword, comparePassword, generateToken, type AuthRequest } from "./auth";
import { logger } from "./logger";
import { isAdmin, canAccessCompany, isActiveUser } from "./middleware/authorization";
import { parseXmlContent, validateChave, isValidNFeXml } from "./xmlParser";
import { parseEventOrInutilizacao, isValidEventXml, detectEventType, type ParsedEventoData, type ParsedInutilizacaoData } from "./xmlEventParser";
import { saveToValidated, fileExists as storageFileExists } from "./fileStorage";
import { saveXmlToContabo, saveEventXmlToContabo } from "./xmlStorageService";
import { readXmlContent, readXmlBuffer } from "./xmlReaderService";
import { sendEmail, sendEmailWithFallback, sendGlobalEmail, sendPublicEmail, testEmailConnection, testGlobalEmailConnection, getTestEmailTemplate, hasEmailConfig, getXmlEmailTemplate, hasGlobalEmailConfig } from "./emailService";
import { generateXmlsExcel, generateSummaryExcel, generateExcelFilename } from "./excelExport";
import { fetchCNPJData, cleanCnpj } from "./receitaWS";
import { getOrCreateCompanyByCnpj } from "./utils/companyAutoCreate";
import { gerarDanfe, danfeExists, getDanfePath } from "./danfeService";
import { testImapConnection } from "./emailTestService";
import { checkEmailMonitor, checkAllActiveMonitors } from "./emailMonitorService";
import { sendXmlsByEmail } from "./xmlEmailService";
import * as contaboStorage from "./contaboStorage";
import {
  migrateXmlToContabo,
  migrateXmlsBatch,
  getXmlsToMigrate,
  countXmlsToMigrate,
  type BatchMigrationResult,
} from "./xmlMigrationService";
import {
  scanContaboForMissingXmls,
  type ScanResult,
} from "./contaboScannerService";
import crypto from "crypto";
import multer from "multer";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import archiver from "archiver";
import unzipper from "unzipper";
import { createExtractorFromData } from "node-unrar-js";
import { createRequire } from "module";
import { pipeline } from "stream/promises";

const MAX_UPLOAD_FILE_MB = parseInt(process.env.UPLOAD_MAX_FILE_MB || "200", 10);
const MAX_EXTRACTED_FILES = parseInt(process.env.UPLOAD_MAX_EXTRACTED_FILES || "20000", 10);
const MAX_EXTRACTED_BYTES =
  parseInt(process.env.UPLOAD_MAX_EXTRACTED_MB || "200", 10) * 1024 * 1024;
const require = createRequire(import.meta.url);
let cachedUnrarWasmBinary: Buffer | null = null;

type UploadProgressInfo = {
  total: number;
  processed: number;
  errors: number;
  done: boolean;
  startedAt: number;
};

const uploadProgressMap = new Map<string, UploadProgressInfo>();

function initUploadProgress(uploadId: string, total: number, initialErrors = 0) {
  uploadProgressMap.set(uploadId, {
    total,
    processed: initialErrors,
    errors: initialErrors,
    done: false,
    startedAt: Date.now(),
  });
}

function bumpUploadProgress(uploadId: string, hadError: boolean) {
  const progress = uploadProgressMap.get(uploadId);
  if (!progress) return;
  progress.processed += 1;
  if (hadError) {
    progress.errors += 1;
  }
}

function completeUploadProgress(uploadId: string) {
  const progress = uploadProgressMap.get(uploadId);
  if (!progress) return;
  progress.done = true;
  setTimeout(() => uploadProgressMap.delete(uploadId), 10 * 60 * 1000);
}

async function getUnrarWasmBinary(): Promise<Buffer | null> {
  if (cachedUnrarWasmBinary) {
    return cachedUnrarWasmBinary;
  }

  try {
    const wasmPath = require.resolve("node-unrar-js/esm/js/unrar.wasm");
    cachedUnrarWasmBinary = await fs.readFile(wasmPath);
    return cachedUnrarWasmBinary;
  } catch (error) {
    console.warn("Não foi possível carregar o unrar.wasm:", error);
    return null;
  }
}

// Configure multer for file uploads
const upload = multer({
  dest: "/tmp/uploads",
  limits: { fileSize: MAX_UPLOAD_FILE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const isXml = file.mimetype === "text/xml" || file.mimetype === "application/xml" || name.endsWith(".xml");
    const isZip = file.mimetype === "application/zip" || file.mimetype === "application/x-zip-compressed" || name.endsWith(".zip");
    const isRar = file.mimetype === "application/x-rar-compressed" || file.mimetype === "application/vnd.rar" || name.endsWith(".rar");

    if (isXml || isZip || isRar) {
      cb(null, true);
    } else {
      cb(new Error("Only XML, ZIP or RAR files are allowed"));
    }
  },
});

const uploadFilesMiddleware = (req: AuthRequest, res: any, next: any) => {
  upload.array("files", 100)(req, res, (err: any) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: "Arquivo excede o limite de tamanho",
          message: `O limite por arquivo é de ${MAX_UPLOAD_FILE_MB}MB.`,
        });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          error: "Limite de arquivos excedido",
          message: "Envie no máximo 100 arquivos por vez.",
        });
      }
      return res.status(400).json({
        error: "Erro no upload",
        message: err.message,
      });
    }

    return res.status(400).json({
      error: "Erro ao processar upload",
      message: err instanceof Error ? err.message : "Arquivo inválido",
    });
  });
};

function isXmlFilename(name: string): boolean {
  return name.toLowerCase().endsWith(".xml");
}

function isZipFilename(name: string): boolean {
  return name.toLowerCase().endsWith(".zip");
}

function isRarFilename(name: string): boolean {
  return name.toLowerCase().endsWith(".rar");
}

function normalizeXmlArchiveName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith("-procnfe.xml")) {
    return lower.replace(/-procnfe\.xml$/, "");
  }
  if (lower.endsWith("-nfe.xml")) {
    return lower.replace(/-nfe\.xml$/, "");
  }
  return lower.replace(/\.xml$/, "");
}

type UploadItem = {
  path: string;
  originalname: string;
};

type ExpandResult = {
  items: UploadItem[];
  errors: Array<{ filename: string; error: string; step: string }>;
  cleanupPaths: string[];
  totalFiles: number;
};

async function extractZipXmls(file: Express.Multer.File): Promise<ExpandResult> {
  const items: UploadItem[] = [];
  const errors: Array<{ filename: string; error: string; step: string }> = [];
  const cleanupPaths: string[] = [file.path];
  let extractedCount = 0;
  let extractedBytes = 0;

  const tempDir = path.join("/tmp/uploads", `extracted-${crypto.randomUUID()}`);
  await fs.mkdir(tempDir, { recursive: true });
  cleanupPaths.push(tempDir);

  const zip = await unzipper.Open.file(file.path);
  for (const entry of zip.files) {
    if (entry.type !== "File") continue;
    if (!isXmlFilename(entry.path)) continue;

    if (extractedCount >= MAX_EXTRACTED_FILES) {
      errors.push({
        filename: file.originalname,
        error: `Limite máximo de ${MAX_EXTRACTED_FILES} XMLs por arquivo compactado excedido`,
        step: "extract",
      });
      break;
    }

    const uncompressedSize = (entry as any).uncompressedSize || (entry as any).vars?.uncompressedSize || 0;
    extractedBytes += uncompressedSize;
    if (extractedBytes > MAX_EXTRACTED_BYTES) {
      errors.push({
        filename: file.originalname,
        error: `Tamanho total extraído excede ${Math.round(MAX_EXTRACTED_BYTES / (1024 * 1024))}MB`,
        step: "extract",
      });
      break;
    }

    const safeName = path.basename(entry.path);
    const destPath = path.join(tempDir, `${crypto.randomUUID()}-${safeName}`);
    await pipeline(entry.stream(), fsSync.createWriteStream(destPath));

    items.push({
      path: destPath,
      originalname: `${file.originalname}::${entry.path}`,
    });
    extractedCount++;
  }

  if (items.length === 0 && errors.length === 0) {
    errors.push({
      filename: file.originalname,
      error: "Nenhum XML encontrado no arquivo ZIP",
      step: "extract",
    });
  }

  return { items, errors, cleanupPaths, totalFiles: items.length };
}

async function extractRarXmls(file: Express.Multer.File): Promise<ExpandResult> {
  const items: UploadItem[] = [];
  const errors: Array<{ filename: string; error: string; step: string }> = [];
  const cleanupPaths: string[] = [file.path];
  let extractedCount = 0;
  let extractedBytes = 0;

  const tempDir = path.join("/tmp/uploads", `extracted-${crypto.randomUUID()}`);
  await fs.mkdir(tempDir, { recursive: true });
  cleanupPaths.push(tempDir);

  const data = await fs.readFile(file.path);
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const wasmBinary = await getUnrarWasmBinary();
  const extractor = await createExtractorFromData({
    data: arrayBuffer,
    ...(wasmBinary ? { wasmBinary } : {}),
  });
  const listResult = extractor.getFileList();

  if (!listResult || listResult[0]?.state !== "SUCCESS") {
    errors.push({
      filename: file.originalname,
      error: `Erro ao listar arquivos do RAR: ${listResult?.[0]?.reason || listResult?.[0]?.state || "desconhecido"}`,
      step: "extract",
    });
    return { items, errors, cleanupPaths, totalFiles: 0 };
  }

  const fileHeaders = Array.from(listResult[1]?.fileHeaders || []);
  const xmlHeaders = fileHeaders.filter((h: any) => !h.flags?.directory && isXmlFilename(h.name));

  if (xmlHeaders.length === 0) {
    errors.push({
      filename: file.originalname,
      error: "Nenhum XML encontrado no arquivo RAR",
      step: "extract",
    });
    return { items, errors, cleanupPaths, totalFiles: 0 };
  }

  if (xmlHeaders.length > MAX_EXTRACTED_FILES) {
    errors.push({
      filename: file.originalname,
      error: `Limite máximo de ${MAX_EXTRACTED_FILES} XMLs por arquivo compactado excedido`,
      step: "extract",
    });
    return { items, errors, cleanupPaths, totalFiles: 0 };
  }

  const extractResult = extractor.extract({ files: xmlHeaders.map((h: any) => h.name) });
  if (!extractResult || extractResult[0]?.state !== "SUCCESS") {
    errors.push({
      filename: file.originalname,
      error: `Erro ao extrair arquivos do RAR: ${extractResult?.[0]?.reason || extractResult?.[0]?.state || "desconhecido"}`,
      step: "extract",
    });
    return { items, errors, cleanupPaths, totalFiles: 0 };
  }

  const extractedFiles = Array.from(extractResult[1]?.files || []);
  for (const fileEntry of extractedFiles) {
    if (extractedCount >= MAX_EXTRACTED_FILES) break;

    const name = fileEntry.fileHeader?.name || "arquivo.xml";
    if (!isXmlFilename(name)) continue;

    const buffer =
      fileEntry.extract?.buffer ||
      fileEntry.extract?.[0]?.buffer ||
      fileEntry.extract?.[0] ||
      fileEntry.extract;

    if (!buffer || (typeof buffer !== "string" && !Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array))) {
      continue;
    }

    const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    extractedBytes += fileBuffer.length;
    if (extractedBytes > MAX_EXTRACTED_BYTES) {
      errors.push({
        filename: file.originalname,
        error: `Tamanho total extraído excede ${Math.round(MAX_EXTRACTED_BYTES / (1024 * 1024))}MB`,
        step: "extract",
      });
      break;
    }

    const safeName = path.basename(name);
    const destPath = path.join(tempDir, `${crypto.randomUUID()}-${safeName}`);
    await fs.writeFile(destPath, fileBuffer);

    items.push({
      path: destPath,
      originalname: `${file.originalname}::${name}`,
    });
    extractedCount++;
  }

  if (items.length === 0 && errors.length === 0) {
    errors.push({
      filename: file.originalname,
      error: "Nenhum XML encontrado no arquivo RAR",
      step: "extract",
    });
  }

  return { items, errors, cleanupPaths, totalFiles: items.length };
}

async function expandUploadedFiles(files: Express.Multer.File[]): Promise<ExpandResult> {
  const allItems: UploadItem[] = [];
  const allErrors: Array<{ filename: string; error: string; step: string }> = [];
  const cleanupPaths: string[] = [];

  for (const file of files) {
    const lowerName = file.originalname.toLowerCase();
    if (isXmlFilename(lowerName)) {
      allItems.push({ path: file.path, originalname: file.originalname });
      continue;
    }

    if (isZipFilename(lowerName)) {
      const result = await extractZipXmls(file);
      allItems.push(...result.items);
      allErrors.push(...result.errors);
      cleanupPaths.push(...result.cleanupPaths);
      continue;
    }

    if (isRarFilename(lowerName)) {
      const result = await extractRarXmls(file);
      allItems.push(...result.items);
      allErrors.push(...result.errors);
      cleanupPaths.push(...result.cleanupPaths);
      continue;
    }

    allErrors.push({
      filename: file.originalname,
      error: "Formato de arquivo não suportado. Use XML, ZIP ou RAR.",
      step: "validation",
    });
    cleanupPaths.push(file.path);
  }

  const dedupedItems: UploadItem[] = [];
  const preferredByBase = new Map<string, UploadItem>();

  for (const item of allItems) {
    const baseName = normalizeXmlArchiveName(path.basename(item.originalname));
    const isProc = item.originalname.toLowerCase().includes("-procnfe.xml");
    const existing = preferredByBase.get(baseName);

    if (!existing) {
      preferredByBase.set(baseName, item);
      continue;
    }

    const existingIsProc = existing.originalname.toLowerCase().includes("-procnfe.xml");
    if (isProc && !existingIsProc) {
      preferredByBase.set(baseName, item);
    }
  }

  for (const item of preferredByBase.values()) {
    dedupedItems.push(item);
  }

  return {
    items: dedupedItems,
    errors: allErrors,
    cleanupPaths,
    totalFiles: dedupedItems.length + allErrors.length,
  };
}

/**
 * Envia email de ativação para novo usuário
 */
async function sendActivationEmail(
  user: any,
  company: any,
  activationToken: string,
  globalEmailSettings?: any
): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:5000';
  const activationLink = `${appUrl}/activate/${activationToken}`;
  const companyName = company?.razaoSocial || company?.nomeFantasia || 'a empresa';
  
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">🎉 Bem-vindo ao Adapta Fiscal!</h1>
      </div>
      
      <div style="padding: 30px; background: #f9fafb;">
        <h2 style="color: #1f2937; margin-top: 0;">Ative sua conta</h2>
        
        <p>Olá <strong>${user.name}</strong>,</p>
        
        <p>Você foi adicionado à empresa <strong>${companyName}</strong> no sistema <strong>Adapta Fiscal</strong>.</p>
        
        <p>Para começar a usar o sistema, você precisa ativar sua conta e definir sua senha.</p>
        
        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
          <p style="margin: 0;"><strong>📱 Informações do Sistema:</strong></p>
          <p style="margin: 10px 0 0 0;">
            <strong>Nome do Sistema:</strong> Adapta Fiscal<br>
            <strong>URL de Acesso:</strong> <a href="${appUrl}" style="color: #059669;">${appUrl}</a><br>
            <strong>Seu Email:</strong> ${user.email}
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${activationLink}" 
             style="display: inline-block; background: #10B981; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Ativar Minha Conta
          </a>
        </div>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0;"><strong>⏰ Importante:</strong></p>
          <p style="margin: 10px 0 0 0;">Este link é válido por <strong>24 horas</strong>. Após este período, será necessário solicitar um novo link de ativação.</p>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          Se você não solicitou esta conta, pode ignorar este email com segurança.
        </p>
        
        <p style="color: #6b7280; font-size: 14px;">
          <strong>Link direto (copie e cole se o botão não funcionar):</strong><br>
          ${activationLink}
        </p>
      </div>
      
      <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">Adapta Fiscal - Sistema de Gestão de XMLs</p>
        <p style="margin: 5px 0 0 0;">Este é um email automático - Não responda</p>
      </div>
    </div>
  `;

  await sendPublicEmail({
    to: user.email,
    subject: "Ative sua conta - Adapta Fiscal",
    html: emailHtml,
  }, globalEmailSettings);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name, role = "viewer" } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      const passwordHash = await hashPassword(password);
      
      // Gera token de ativação
      const activationToken = crypto.randomUUID();
      const activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      const user = await storage.createUser({
        email,
        passwordHash,
        name,
        role,
        active: false, // Inativo até ativar
        activationToken,
        activationExpiresAt,
      });

      await storage.logAction({
        userId: user.id,
        action: "register",
        details: JSON.stringify({ email }),
      });

      // Envia email de ativação (assíncrono)
      const company = { razaoSocial: "Adapta Fiscal", nomeFantasia: "Adapta Fiscal" };
      const globalEmailSettings = await storage.getEmailGlobalSettings();
      sendActivationEmail(user, company, activationToken, globalEmailSettings).catch(err => {
        console.error("Error sending activation email:", err);
      });

      // Não retorna token pois usuário precisa ativar conta primeiro
      res.json({
        message: "Usuário criado com sucesso! Verifique seu email para ativar a conta.",
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    } catch (error) {
      logger.error("Erro ao registrar usuário", error instanceof Error ? error : new Error(String(error)), {
        email: req.body.email,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Verificar se usuário está ativo
      if (!user.active) {
        return res.status(403).json({ 
          error: "Conta inativa",
          message: "Sua conta precisa ser ativada. Verifique seu email ou solicite reenvio do link de ativação."
        });
      }

      // Atualizar último login
      await storage.updateUserLastLogin(user.id);

      // Capturar IP e User Agent
      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Criar log de acesso
      const accessLog = await storage.createAccessLog({
        userId: user.id,
        companyId: undefined, // Será definido quando selecionar empresa
        loginAt: new Date(),
        ipAddress,
        userAgent,
      });

      await storage.logAction({
        userId: user.id,
        action: "login",
        details: JSON.stringify({ email, ipAddress, accessLogId: accessLog.id }),
      });

      const token = generateToken(user.id, user.email, user.role, user.active);

      res.json({
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          role: user.role,
          active: user.active 
        },
        token,
        accessLogId: accessLog.id, // Para uso no logout
      });
    } catch (error) {
      logger.error("Erro no login", error instanceof Error ? error : new Error(String(error)), {
        email: req.body.email,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/auth/logout - Registra logout
  app.post("/api/auth/logout", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { accessLogId } = req.body;

      if (accessLogId) {
        await storage.updateAccessLogLogout(accessLogId);
      }

      await storage.logAction({
        userId: req.user!.id,
        action: "logout",
        details: JSON.stringify({ accessLogId }),
      });

      res.json({ success: true, message: "Logout realizado com sucesso" });
    } catch (error) {
      logger.error("Erro no logout", error instanceof Error ? error : new Error(String(error)), {
        userId: req.user?.id,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/auth/select-company - Registra seleção inicial de empresa (atualiza accessLog do login)
  app.post("/api/auth/select-company", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId, accessLogId } = req.body;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      // Atualizar o accessLog do login com a empresa selecionada
      if (accessLogId) {
        await storage.updateAccessLogCompany(accessLogId, companyId);
      }

      await storage.logAction({
        userId: req.user!.id,
        action: "select_company",
        details: JSON.stringify({ companyId, accessLogId }),
      });

      res.json({ success: true, message: "Empresa selecionada com sucesso" });
    } catch (error) {
      logger.error("Erro ao selecionar empresa", error instanceof Error ? error : new Error(String(error)), {
        userId: req.user?.id,
        companyId: req.body.companyId,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/auth/switch-company - Registra troca de empresa
  app.post("/api/auth/switch-company", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId } = req.body;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      // Capturar IP e User Agent
      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Criar log de troca de empresa
      await storage.createAccessLog({
        userId: req.user!.id,
        companyId,
        switchedCompanyAt: new Date(),
        ipAddress,
        userAgent,
      });

      await storage.logAction({
        userId: req.user!.id,
        action: "switch_company",
        details: JSON.stringify({ companyId }),
      });

      res.json({ success: true, message: "Empresa alterada com sucesso" });
    } catch (error) {
      console.error("Switch company error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Activation Routes
  // GET /api/auth/activate/:token - Valida token e retorna informações do usuário
  app.get("/api/auth/activate/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const user = await storage.getUserByActivationToken(token);
      
      if (!user) {
        return res.status(404).json({ 
          error: "Token inválido",
          message: "Link de ativação inválido ou expirado" 
        });
      }

      // Verifica se token expirou
      if (user.activationExpiresAt && new Date() > new Date(user.activationExpiresAt)) {
        return res.status(410).json({ 
          error: "Token expirado",
          message: "O link de ativação expirou. Solicite um novo link." 
        });
      }

      res.json({
        email: user.email,
        name: user.name,
      });
    } catch (error) {
      console.error("Check activation token error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/auth/activate - Ativa conta e define senha
  app.post("/api/auth/activate", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const user = await storage.getUserByActivationToken(token);
      
      if (!user) {
        return res.status(404).json({ 
          error: "Token inválido",
          message: "Link de ativação inválido" 
        });
      }

      // Verifica se token expirou
      if (user.activationExpiresAt && new Date() > new Date(user.activationExpiresAt)) {
        return res.status(410).json({ 
          error: "Token expirado",
          message: "O link de ativação expirou. Solicite um novo link." 
        });
      }

      // Atualiza usuário: ativa e define senha
      const passwordHash = await hashPassword(password);
      await storage.activateUser(user.id, passwordHash);

      await storage.logAction({
        userId: user.id,
        action: "activate_account",
        details: JSON.stringify({ email: user.email }),
      });

      res.json({ 
        message: "Conta ativada com sucesso!",
        email: user.email 
      });
    } catch (error) {
      console.error("Activate account error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/auth/resend-activation - Reenvia email de ativação
  app.post("/api/auth/resend-activation", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Por segurança, não revela se email existe
        return res.json({ message: "Se o email existir, um novo link será enviado" });
      }

      if (user.active) {
        return res.status(400).json({ 
          error: "Conta já ativada",
          message: "Esta conta já está ativa. Você pode fazer login normalmente." 
        });
      }

      // Gera novo token
      const activationToken = crypto.randomUUID();
      const activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await storage.updateActivationToken(user.id, activationToken, activationExpiresAt);

      // Busca empresa do usuário (primeira empresa vinculada)
      const companies = await storage.getCompaniesByUser(user.id);
      const company = companies[0] || { razaoSocial: "Adapta Fiscal" };

      // Reenvia email
      const globalEmailSettings = await storage.getEmailGlobalSettings();
      await sendActivationEmail(user, company, activationToken, globalEmailSettings);

      res.json({ message: "Novo link de ativação enviado por email" });
    } catch (error) {
      console.error("Resend activation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/auth/forgot-password - Solicita reset de senha
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      
      // Por segurança, sempre retorna sucesso mesmo se email não existir
      if (!user) {
        return res.json({ 
          success: true,
          message: "Se o email existir em nossa base, você receberá um link para redefinir sua senha." 
        });
      }

      // Gera token de reset (válido por 1 hora)
      const resetToken = crypto.randomUUID();
      const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await storage.setPasswordResetToken(user.id, resetToken, resetExpiresAt);

      // Envia email
      const resetLink = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password/${resetToken}`;
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Redefinir Senha</h1>
          <p>Olá, ${user.name}!</p>
          <p>Você solicitou a redefinição de senha da sua conta no Adapta Fiscal.</p>
          <p>Clique no botão abaixo para criar uma nova senha:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #2196F3; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Redefinir Senha
            </a>
          </p>
          <p style="color: #666; font-size: 12px;">
            Este link expira em 1 hora.<br>
            Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá inalterada.
          </p>
        </div>
      `;

      const globalEmailSettings = await storage.getEmailGlobalSettings();
      await sendPublicEmail({
        to: user.email,
        subject: "Redefinir Senha - Adapta Fiscal",
        html: emailHtml,
      }, globalEmailSettings);

      await storage.logAction({
        userId: user.id,
        action: "forgot_password_request",
        details: JSON.stringify({ email }),
      });

      res.json({ 
        success: true,
        message: "Se o email existir em nossa base, você receberá um link para redefinir sua senha." 
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/auth/reset-password - Redefine senha com token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const user = await storage.getUserByResetToken(token);
      
      if (!user) {
        return res.status(400).json({ 
          error: "Invalid token",
          message: "Token inválido ou expirado. Solicite um novo link de redefinição."
        });
      }

      // Verificar expiração
      if (!user.resetExpiresAt || new Date() > new Date(user.resetExpiresAt)) {
        return res.status(400).json({ 
          error: "Token expired",
          message: "Token expirado. Solicite um novo link de redefinição."
        });
      }

      // Atualizar senha
      const passwordHash = await hashPassword(password);
      await storage.resetPassword(user.id, passwordHash);

      await storage.logAction({
        userId: user.id,
        action: "password_reset",
        details: JSON.stringify({ email: user.email }),
      });

      res.json({ 
        success: true,
        message: "Senha redefinida com sucesso! Você já pode fazer login com a nova senha." 
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============= PUBLIC ROUTES - Cadastro de Empresa =============
  
  // POST /api/public/check-cnpj - Verifica CNPJ e busca dados se não existe
  app.post("/api/public/check-cnpj", async (req, res) => {
    try {
      const { cnpj } = req.body;

      if (!cnpj) {
        return res.status(400).json({ error: "CNPJ é obrigatório" });
      }

      const cleanedCnpj = cleanCnpj(cnpj);

      // Verifica se empresa já existe
      const existingCompany = await storage.getCompanyByCnpj(cleanedCnpj);
      
      if (existingCompany) {
        // Busca emails vinculados
        const users = await storage.getCompanyUsers(existingCompany.id);
        const emails = users.map(u => ({
          email: u.email,
          name: u.name,
          active: u.active,
        }));

        return res.json({
          exists: true,
          company: {
            id: existingCompany.id,
            cnpj: existingCompany.cnpj,
            razaoSocial: existingCompany.razaoSocial,
            nomeFantasia: existingCompany.nomeFantasia,
            inscricaoEstadual: existingCompany.inscricaoEstadual,
            telefone: existingCompany.telefone,
            email: existingCompany.email,
            rua: existingCompany.rua,
            numero: existingCompany.numero,
            bairro: existingCompany.bairro,
            cidade: existingCompany.cidade,
            uf: existingCompany.uf,
            cep: existingCompany.cep,
          },
          emails: emails,
        });
      }

      // Busca na ReceitaWS
      const cnpjData = await fetchCNPJData(cleanedCnpj);
      
      if (!cnpjData.success || !cnpjData.data) {
        return res.status(400).json({
          error: cnpjData.error || "CNPJ não encontrado na ReceitaWS",
        });
      }

      return res.json({
        exists: false,
        companyData: cnpjData.data,
      });
    } catch (error) {
      console.error("Check CNPJ error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/public/create-company - Cria empresa após confirmação
  app.post("/api/public/create-company", async (req, res) => {
    try {
      const { cnpj, confirm } = req.body;

      if (!cnpj) {
        return res.status(400).json({ error: "CNPJ é obrigatório" });
      }

      if (!confirm) {
        return res.status(400).json({ error: "Confirmação é obrigatória" });
      }

      const cleanedCnpj = cleanCnpj(cnpj);

      // Verifica se já existe
      const existingCompany = await storage.getCompanyByCnpj(cleanedCnpj);
      if (existingCompany) {
        return res.status(400).json({ 
          error: "Empresa já cadastrada",
          companyId: existingCompany.id,
        });
      }

      // Busca dados na ReceitaWS
      const cnpjData = await fetchCNPJData(cleanedCnpj);
      
      if (!cnpjData.success || !cnpjData.data) {
        return res.status(400).json({
          error: cnpjData.error || "CNPJ não encontrado na ReceitaWS",
        });
      }

      // Cria empresa
      const company = await storage.createCompany({
        cnpj: cleanedCnpj,
        razaoSocial: cnpjData.data.razaoSocial,
        nomeFantasia: cnpjData.data.nomeFantasia || cnpjData.data.razaoSocial,
        rua: cnpjData.data.rua,
        numero: cnpjData.data.numero,
        bairro: cnpjData.data.bairro,
        cidade: cnpjData.data.cidade,
        uf: cnpjData.data.uf,
        cep: cnpjData.data.cep,
        telefone: cnpjData.data.telefone,
        email: cnpjData.data.email,
        ativo: true,
        status: 2, // Liberado
      });

      res.json({
        success: true,
        company: {
          id: company.id,
          cnpj: company.cnpj,
          razaoSocial: company.razaoSocial,
          nomeFantasia: company.nomeFantasia,
        },
      });
    } catch (error) {
      console.error("Create company error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/public/link-email - Vincula email à empresa
  app.post("/api/public/link-email", async (req, res) => {
    try {
      const { companyId, email, name } = req.body;

      if (!companyId || !email) {
        return res.status(400).json({ error: "companyId e email são obrigatórios" });
      }

      // Valida email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Email inválido" });
      }

      // Verifica se empresa existe
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      // Verifica se email já existe
      const existingUser = await storage.getUserByEmail(email);
      let user = existingUser;
      let wasCreated = false;

      const globalEmailSettings = await storage.getEmailGlobalSettings();

      if (!existingUser) {
        // Cria novo usuário
        const activationToken = crypto.randomUUID();
        const activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
        
        // Gera senha temporária (usuário vai definir na ativação)
        const tempPassword = crypto.randomBytes(16).toString('hex');
        const passwordHash = await hashPassword(tempPassword);

        user = await storage.createUser({
          email,
          passwordHash,
          name: name || email.split('@')[0],
          role: "cliente",
          active: false,
          activationToken,
          activationExpiresAt,
        });

        wasCreated = true;

        // Envia email de ativação
        await sendActivationEmail(user, company, activationToken, globalEmailSettings);
      } else {
        // Email já existe - vincula à empresa
        // Verifica se já está vinculado
        const companies = await storage.getCompaniesByUser(user.id);
        const alreadyLinked = companies.some(c => c.id === companyId);
        
        if (!alreadyLinked) {
          await storage.linkUserToCompany(user.id, companyId);
        }

        // Envia email informativo
        const appUrl = process.env.APP_URL || 'http://localhost:5000';
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">📄 Adapta Fiscal</h1>
            </div>
            
            <div style="padding: 30px; background: #f9fafb;">
              <h2 style="color: #1f2937; margin-top: 0;">Você foi vinculado à uma empresa</h2>
              
              <p>Olá <strong>${user.name}</strong>,</p>
              
              <p>Seu email foi vinculado à empresa <strong>${company.razaoSocial || company.nomeFantasia}</strong> no sistema Adapta Fiscal.</p>
              
              <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
                <p style="margin: 0;"><strong>📱 Informações da Empresa:</strong></p>
                <p style="margin: 10px 0 0 0;">
                  <strong>Razão Social:</strong> ${company.razaoSocial}<br>
                  ${company.nomeFantasia ? `<strong>Nome Fantasia:</strong> ${company.nomeFantasia}<br>` : ''}
                  <strong>CNPJ:</strong> ${company.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}<br>
                  ${company.telefone ? `<strong>Telefone:</strong> ${company.telefone}<br>` : ''}
                  ${company.email ? `<strong>Email:</strong> ${company.email}<br>` : ''}
                </p>
                ${company.rua ? `
                  <p style="margin: 10px 0 0 0;">
                    <strong>Endereço:</strong><br>
                    ${company.rua}${company.numero ? `, ${company.numero}` : ''}<br>
                    ${company.bairro ? `${company.bairro} - ` : ''}${company.cidade} / ${company.uf}<br>
                    ${company.cep ? `CEP: ${company.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : ''}
                  </p>
                ` : ''}
              </div>
              
              <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
                <p style="margin: 0;"><strong>📱 Informações do Sistema:</strong></p>
                <p style="margin: 10px 0 0 0;">
                  <strong>Nome do Sistema:</strong> Adapta Fiscal<br>
                  <strong>URL de Acesso:</strong> <a href="${appUrl}" style="color: #059669;">${appUrl}</a><br>
                  <strong>Seu Email:</strong> ${user.email}
                </p>
              </div>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}" 
                   style="display: inline-block; background: #10B981; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Acessar Sistema
                </a>
              </p>
            </div>
            
            <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">Adapta Fiscal - Sistema de Gestão de XMLs</p>
              <p style="margin: 5px 0 0 0;">Este é um email automático - Não responda</p>
            </div>
          </div>
        `;

        await sendPublicEmail({
          to: user.email,
          subject: "Você foi vinculado à uma empresa - Adapta Fiscal",
          html: emailHtml,
        }, globalEmailSettings);
      }

      // Garante que usuário está vinculado à empresa
      const companies = await storage.getCompaniesByUser(user.id);
      const alreadyLinked = companies.some(c => c.id === companyId);
      
      if (!alreadyLinked) {
        await storage.linkUserToCompany(user.id, companyId);
      }

      res.json({
        success: true,
        wasCreated,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          active: user.active,
        },
        message: wasCreated 
          ? "Usuário criado e email de ativação enviado" 
          : "Usuário vinculado e email informativo enviado",
      });
    } catch (error) {
      console.error("Link email error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/auth/request-access - Solicita acesso ao sistema
  app.post("/api/auth/request-access", async (req, res) => {
    try {
      const { name, email, cnpj, message } = req.body;

      if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required" });
      }

      // Verificar se email já tem conta
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ 
          error: "Email already registered",
          message: "Este email já possui uma conta. Tente fazer login ou recuperar sua senha."
        });
      }

      // Criar solicitação
      const request = await storage.createAccessRequest({
        name,
        email,
        cnpj: cnpj ? cnpj.replace(/\D/g, '') : undefined,
        message: message || undefined,
        status: "pending",
      });

      // Enviar email para admin
      const adminUsers = await storage.getUsersByRole("admin");
      
      if (adminUsers.length > 0) {
        const adminEmail = adminUsers[0].email;
        
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Nova Solicitação de Acesso</h1>
            <p>Um novo usuário solicitou acesso ao sistema Adapta Fiscal:</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Nome:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              ${cnpj ? `<p><strong>CNPJ:</strong> ${cnpj}</p>` : ''}
              ${message ? `<p><strong>Mensagem:</strong> ${message}</p>` : ''}
              <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            </div>
            <p>Acesse o painel administrativo para aprovar ou rejeitar esta solicitação.</p>
          </div>
        `;

        const globalEmailSettings = await storage.getEmailGlobalSettings();
        await sendPublicEmail({
          to: adminEmail,
          subject: `Nova Solicitação de Acesso - ${name}`,
          html: emailHtml,
        }, globalEmailSettings);
      }

      res.status(201).json({ 
        success: true,
        message: "Solicitação enviada com sucesso! Você receberá um email assim que for aprovada." 
      });
    } catch (error) {
      console.error("Request access error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/access-requests - Lista solicitações de acesso (apenas admin)
  app.get("/api/access-requests", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { status } = req.query;
      
      const requests = await storage.getAllAccessRequests(status as string | undefined);
      res.json(requests);
    } catch (error) {
      console.error("Get access requests error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /api/access-requests/:id - Aprova/rejeita solicitação (apenas admin)
  app.put("/api/access-requests/:id", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status, action } = req.body; // action: approve ou reject

      if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Action must be 'approve' or 'reject'" });
      }

      const request = await storage.getAccessRequest(id);
      if (!request) {
        return res.status(404).json({ error: "Access request not found" });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      
      await storage.updateAccessRequestStatus(id, newStatus, req.user!.id);

      const globalEmailSettings = await storage.getEmailGlobalSettings();

      // Se aprovado, criar usuário
      if (action === 'approve') {
        // Gerar token de ativação
        const activationToken = crypto.randomUUID();
        const activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const tempPassword = crypto.randomBytes(32).toString('hex');
        const passwordHash = await hashPassword(tempPassword);

        const user = await storage.createUser({
          email: request.email,
          name: request.name,
          passwordHash,
          role: "cliente",
          active: false,
          activationToken,
          activationExpiresAt,
        });

        // Enviar email de ativação usando função padrão
        const company = { razaoSocial: "Adapta Fiscal", nomeFantasia: "Adapta Fiscal" };
        await sendActivationEmail(user, company, activationToken, globalEmailSettings);
      } else {
        // Se rejeitado, enviar email informando
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Solicitação de Acesso</h1>
            <p>Olá, ${request.name}!</p>
            <p>Informamos que sua solicitação de acesso ao Adapta Fiscal não foi aprovada no momento.</p>
            <p>Se tiver dúvidas, entre em contato conosco.</p>
          </div>
        `;

        await sendPublicEmail({
          to: request.email,
          subject: 'Solicitação de Acesso - Adapta Fiscal',
          html: emailHtml,
        }, globalEmailSettings);
      }

      await storage.logAction({
        userId: req.user!.id,
        action: `access_request_${action}`,
        details: JSON.stringify({ requestId: id, email: request.email }),
      });

      res.json({ 
        success: true,
        message: `Solicitação ${action === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso` 
      });
    } catch (error) {
      console.error("Update access request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/access-requests/:id - Remove solicitação (apenas admin)
  app.delete("/api/access-requests/:id", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      await storage.deleteAccessRequest(id);

      await storage.logAction({
        userId: req.user!.id,
        action: "delete_access_request",
        details: JSON.stringify({ requestId: id }),
      });

      res.status(204).send();
    } catch (error) {
      console.error("Delete access request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // CNPJ Validation Route (ReceitaWS)
  app.get("/api/cnpj/:cnpj", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { cnpj } = req.params;

      const result = await fetchCNPJData(cnpj);

      if (!result.success) {
        return res.status(400).json({ 
          error: result.error || "Erro ao consultar CNPJ" 
        });
      }

      await storage.logAction({
        userId: req.user!.id,
        action: "validate_cnpj",
        details: JSON.stringify({ 
          cnpj: cleanCnpj(cnpj),
          cached: result.cached,
        }),
      });

      res.json({
        success: true,
        data: result.data,
        cached: result.cached,
      });

    } catch (error) {
      console.error("CNPJ validation error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Companies Routes
  app.get("/api/companies", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const companies = await storage.getCompaniesByUser(req.user!.id);
      res.json(companies);
    } catch (error) {
      console.error("Get companies error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/companies", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const companyData = req.body;

      // Sanitizar telefone para garantir que não exceda 20 caracteres
      if (companyData.telefone && typeof companyData.telefone === 'string') {
        const telefone = companyData.telefone.trim();
        companyData.telefone = telefone.length > 20 ? telefone.substring(0, 20) : telefone;
      }

      // Check if CNPJ already exists
      const existing = await storage.getCompanyByCnpj(companyData.cnpj);
      if (existing) {
        return res.status(400).json({ error: "CNPJ already registered" });
      }

      const company = await storage.createCompany(companyData);

      // Add current user to company
      await storage.addUserToCompany(req.user!.id, company.id);

      await storage.logAction({
        userId: req.user!.id,
        action: "create_company",
        details: JSON.stringify({ companyId: company.id, cnpj: company.cnpj }),
      });

      res.status(201).json(company);
    } catch (error) {
      logger.error("Erro ao criar empresa", error instanceof Error ? error : new Error(String(error)), {
        userId: req.user?.id,
        cnpj: req.body.cnpj,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/companies/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const updateData = req.body;

      // Sanitizar telefone para garantir que não exceda 20 caracteres
      if (updateData.telefone && typeof updateData.telefone === 'string') {
        const telefone = updateData.telefone.trim();
        updateData.telefone = telefone.length > 20 ? telefone.substring(0, 20) : telefone;
      }

      // Admin pode atualizar qualquer empresa, outros usuários só suas próprias
      if (user.role !== "admin") {
        const companies = await storage.getCompaniesByUser(user.id);
        const hasAccess = companies.some((c) => c.id === id);
        
        if (!hasAccess) {
          return res.status(403).json({ error: "Acesso negado à empresa" });
        }
      }

      const company = await storage.updateCompany(id, updateData);

      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      await storage.logAction({
        userId: req.user!.id,
        action: "update_company",
        details: JSON.stringify({ companyId: id }),
      });

      res.json(company);
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/companies/:id", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      await storage.deleteCompany(id);

      await storage.logAction({
        userId: req.user!.id,
        action: "delete_company",
        details: JSON.stringify({ companyId: id }),
      });

      res.status(204).send();
    } catch (error) {
      console.error("Delete company error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Company Users Management Routes - Gestão de usuários vinculados à empresa
  // GET /api/companies/:id/users - Lista usuários vinculados
  app.get("/api/companies/:id/users", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      // Busca empresa
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Busca usuários vinculados
      const companyUsersData = await storage.getCompanyUsers(id);
      
      res.json(companyUsersData);
    } catch (error) {
      console.error("Get company users error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/companies/:id/users - Adiciona/cria usuário e vincula
  app.post("/api/companies/:id/users", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { email, name, role = "cliente" } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Verifica se empresa existe
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Busca usuário existente por email
      let user = await storage.getUserByEmail(email);

      if (user) {
        // Usuário já existe - apenas vincula
        // Verifica se já está vinculado
        const existingLink = await storage.checkCompanyUserLink(user.id, id);
        if (existingLink) {
          return res.status(400).json({ error: "User already linked to this company" });
        }

        // Cria vínculo
        await storage.linkUserToCompany(user.id, id);

        await storage.logAction({
          userId: req.user!.id,
          action: "link_user_to_company",
          details: JSON.stringify({ userId: user.id, companyId: id }),
        });

        res.json({
          message: "User linked successfully",
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            active: user.active,
          },
          wasCreated: false,
        });
      } else {
        // Usuário não existe - criar novo
        if (!name) {
          return res.status(400).json({ error: "Name is required for new users" });
        }

        // Gera token de ativação
        const activationToken = crypto.randomUUID();
        const activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

        // Cria usuário com senha temporária (não será usada)
        const tempPassword = crypto.randomBytes(32).toString('hex');
        const passwordHash = await hashPassword(tempPassword);

        user = await storage.createUser({
          email,
          name,
          passwordHash,
          role,
          active: false, // Inativo até ativar
          activationToken,
          activationExpiresAt,
        });

        // Vincula à empresa
        await storage.linkUserToCompany(user.id, id);

        // Envia email de ativação (assíncrono)
        const globalEmailSettings = await storage.getEmailGlobalSettings();
        sendActivationEmail(user, company, activationToken, globalEmailSettings).catch(err => {
          console.error("Error sending activation email:", err);
        });

        await storage.logAction({
          userId: req.user!.id,
          action: "create_user_and_link",
          details: JSON.stringify({ userId: user.id, companyId: id, email }),
        });

        res.json({
          message: "User created and linked successfully. Activation email sent.",
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            active: user.active,
          },
          wasCreated: true,
        });
      }
    } catch (error) {
      console.error("Add company user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/companies/:companyId/users/:userId - Remove vínculo
  app.delete("/api/companies/:companyId/users/:userId", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { companyId, userId } = req.params;

      await storage.unlinkUserFromCompany(userId, companyId);

      await storage.logAction({
        userId: req.user!.id,
        action: "unlink_user_from_company",
        details: JSON.stringify({ userId, companyId }),
      });

      res.status(204).send();
    } catch (error) {
      console.error("Remove company user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Accountants Routes
  app.get("/api/accountants", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const accountants = await storage.getAllAccountants();
      res.json(accountants);
    } catch (error) {
      console.error("Get accountants error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/accountants", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { nome, emailContador, companyIds } = req.body;

      const accountant = await storage.createAccountant({ nome, emailContador });

      // Add companies to accountant
      if (companyIds && Array.isArray(companyIds)) {
        for (const companyId of companyIds) {
          await storage.addCompanyToAccountant(accountant.id, companyId);
        }
      }

      await storage.logAction({
        userId: req.user!.id,
        action: "create_accountant",
        details: JSON.stringify({ accountantId: accountant.id }),
      });

      res.status(201).json(accountant);
    } catch (error) {
      console.error("Create accountant error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/accountants/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { nome, emailContador, companyIds } = req.body;

      // Update accountant basic info
      const updateData: any = {};
      if (nome !== undefined) updateData.nome = nome;
      if (emailContador !== undefined) updateData.emailContador = emailContador;
      
      // Sanitizar telefone para garantir que não exceda 20 caracteres
      if (req.body.telefone !== undefined) {
        if (req.body.telefone && typeof req.body.telefone === 'string') {
          const telefone = req.body.telefone.trim();
          updateData.telefone = telefone.length > 20 ? telefone.substring(0, 20) : telefone;
        } else {
          updateData.telefone = req.body.telefone;
        }
      }

      const updatedAccountant = await storage.updateAccountant(id, updateData);

      if (!updatedAccountant) {
        return res.status(404).json({ error: "Accountant not found" });
      }

      // Update company associations if provided
      if (companyIds && Array.isArray(companyIds)) {
        // Remove all existing associations
        await storage.removeAllCompaniesFromAccountant(id);
        
        // Add new associations
        for (const companyId of companyIds) {
          await storage.addCompanyToAccountant(id, companyId);
        }
      }

      await storage.logAction({
        userId: req.user!.id,
        action: "update_accountant",
        details: JSON.stringify({ accountantId: id }),
      });

      res.json(updatedAccountant);
    } catch (error) {
      console.error("Update accountant error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/accountants/:id", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      await storage.deleteAccountant(id);

      await storage.logAction({
        userId: req.user!.id,
        action: "delete_accountant",
        details: JSON.stringify({ accountantId: id }),
      });

      res.status(204).send();
    } catch (error) {
      console.error("Delete accountant error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get companies for an accountant
  app.get("/api/accountants/:id/companies", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const companies = await storage.getAccountantCompanies(id);
      res.json(companies);
    } catch (error) {
      console.error("Get accountant companies error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Email Routes
  // Global email settings (admin only)
  app.get("/api/email/global", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const settings = await storage.getEmailGlobalSettings();
      res.json(settings || null);
    } catch (error) {
      console.error("Get global email settings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/email/global", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { host, port, user, password, fromEmail, fromName, useSsl, useTls } = req.body;
      const existingSettings = await storage.getEmailGlobalSettings();

      const resolvedPassword = password || existingSettings?.password;
      if (!host || !port || !user || !resolvedPassword || !fromEmail || !fromName) {
        return res.status(400).json({ error: "Campos obrigatórios: host, port, user, password, fromEmail, fromName" });
      }

      const settings = await storage.upsertEmailGlobalSettings({
        host,
        port: Number(port),
        user,
        password: resolvedPassword,
        fromEmail,
        fromName,
        useSsl: !!useSsl,
        useTls: !!useTls,
      });

      await storage.logAction({
        userId: req.user!.id,
        action: "update_global_email_settings",
        details: JSON.stringify({ host, fromEmail }),
      });

      res.json(settings);
    } catch (error) {
      console.error("Update global email settings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/email/global/test", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const settings = await storage.getEmailGlobalSettings();
      if (!settings || !hasGlobalEmailConfig(settings)) {
        return res.status(400).json({ error: "Configuração global de email incompleta" });
      }

      const testResult = await testGlobalEmailConnection(settings);
      if (!testResult.success) {
        return res.status(400).json({ error: `Falha na conexão: ${testResult.error}` });
      }

      const sendResult = await sendGlobalEmail(settings, {
        to: settings.fromEmail,
        subject: "Teste de Email Global - Adapta Fiscal",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>✅ Email Global configurado com sucesso!</h2>
            <p>Esta é uma mensagem de teste da configuração global de email.</p>
            <p><strong>Remetente:</strong> ${settings.fromName} &lt;${settings.fromEmail}&gt;</p>
          </div>
        `,
      });

      if (!sendResult.success) {
        return res.status(500).json({ error: `Falha ao enviar email: ${sendResult.error}` });
      }

      await storage.logAction({
        userId: req.user!.id,
        action: "test_global_email_settings",
        details: JSON.stringify({ messageId: sendResult.messageId }),
      });

      res.json({
        success: true,
        message: "Email de teste enviado com sucesso!",
        messageId: sendResult.messageId,
      });
    } catch (error) {
      console.error("Test global email error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Test email configuration
  app.post("/api/email/test", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId } = req.body;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      if (!hasEmailConfig(company)) {
        return res.status(400).json({ 
          error: "Configuração de email incompleta. Configure Host, Porta, Usuário e Senha." 
        });
      }

      // Testa a conexão
      const testResult = await testEmailConnection(company);
      if (!testResult.success) {
        return res.status(400).json({ 
          error: `Falha na conexão: ${testResult.error}` 
        });
      }

      // Envia email de teste
      const emailTemplate = getTestEmailTemplate(company.razaoSocial);
      const sendResult = await sendEmail(company, {
        to: company.emailUser!,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });

      if (!sendResult.success) {
        return res.status(500).json({ 
          error: `Falha ao enviar email: ${sendResult.error}` 
        });
      }

      await storage.logAction({
        userId: req.user!.id,
        action: "test_email",
        details: JSON.stringify({ companyId, messageId: sendResult.messageId }),
      });

      res.json({
        success: true,
        message: "Email de teste enviado com sucesso!",
        messageId: sendResult.messageId,
      });

    } catch (error) {
      console.error("Test email error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Send email with XML attachment
  app.post("/api/email/send-xml", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId, to, xmlId, message } = req.body;

      if (!companyId || !to || !xmlId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      const xml = await storage.getXml(xmlId);
      if (!xml) {
        return res.status(404).json({ error: "XML not found" });
      }

      // Lê o arquivo XML (do sistema local ou Contabo)
      const xmlContent = await readXmlContent(xml.filepath);
      if (!xmlContent) {
        return res.status(404).json({ error: "XML file not found" });
      }

      // Prepara email com template personalizado
      const subject = `NFe ${xml.chave.substring(0, 8)}... - ${company.razaoSocial}`;
      const htmlBody = `
        <h2 style="margin-top: 0; color: #111827;">Documento Fiscal XML</h2>
        
        <p>Segue em anexo o arquivo XML do documento fiscal.</p>
        
        <div style="background: #f0fdf4; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <strong>📄 Chave de Acesso:</strong> ${xml.chave}<br>
          <strong>📋 Tipo:</strong> ${xml.tipoDoc}<br>
          <strong>📅 Data Emissão:</strong> ${xml.dataEmissao}<br>
          <strong>💰 Valor:</strong> R$ ${parseFloat(xml.totalNota).toFixed(2)}<br>
          <strong>📊 Categoria:</strong> ${xml.categoria}
        </div>
        
        ${message ? `<p><strong>Mensagem:</strong><br>${message}</p>` : ''}
        
        <p style="margin-top: 30px;">
          Atenciosamente,<br>
          <strong>${company.razaoSocial}</strong>
        </p>
      `;

      const textBody = `
Documento Fiscal XML

Segue em anexo o arquivo XML do documento fiscal.

Chave: ${xml.chave}
Tipo: ${xml.tipoDoc}
Data: ${xml.dataEmissao}
Valor: R$ ${parseFloat(xml.totalNota).toFixed(2)}
Categoria: ${xml.categoria}

${message || ''}

Atenciosamente,
${company.razaoSocial}
      `.trim();

      const emailData = {
        to,
        subject,
        html: `
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Inter, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700;">📄 Adapta Fiscal</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Gestão de Documentos Fiscais</p>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
              ${htmlBody}
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 12px; color: #6b7280; border: 1px solid #e5e7eb; border-top: none;">
              <p style="margin: 0;">Este é um email automático do sistema Adapta Fiscal.</p>
            </div>
          </body>
          </html>
        `,
        text: textBody,
        attachments: [
          {
            filename: `NFe${xml.chave}.xml`,
            content: xmlContent,
          },
        ],
      };

      const globalEmailSettings = await storage.getEmailGlobalSettings();
      const sendResult = await sendEmailWithFallback(company, emailData, globalEmailSettings);

      if (!sendResult.success) {
        const isConfigError = sendResult.error?.includes("Configuração de email incompleta");
        return res.status(isConfigError ? 400 : 500).json({ 
          error: `Falha ao enviar email: ${sendResult.error}` 
        });
      }

      await storage.logAction({
        userId: req.user!.id,
        action: "send_xml_email",
        details: JSON.stringify({ 
          companyId, 
          xmlId, 
          to,
          messageId: sendResult.messageId 
        }),
      });

      res.json({
        success: true,
        message: "Email enviado com sucesso!",
        messageId: sendResult.messageId,
      });

    } catch (error) {
      console.error("Send email error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // XML Sequence Analysis - Análise de Sequência de Notas
  app.get("/api/xmls/sequence-analysis", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId, modelo, periodStart, periodEnd, serie } = req.query;

      if (!companyId || !modelo) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      // Check access
      const hasAccess = await canAccessCompany(req.user!.id, companyId as string);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get company
      const company = await storage.getCompany(companyId as string);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Get XMLs emitted by company
      const xmls = await storage.getXmlsByCnpj(company.cnpj, {
        tipoDoc: modelo === "55" ? "NFe" : "NFCe",
        categoria: "emitida",
        dataInicio: periodStart as string,
        dataFim: periodEnd as string,
      });

      // Get inutilizações (consider year of inutilização, not only event date)
      const allEvents = await storage.getXmlEventsByCompany(companyId as string);
      const inutilizacoes = allEvents.filter((e) => {
        if (e.tipoEvento !== "inutilizacao") return false;
        if (e.modelo !== modelo) return false;
        if (serie && e.serie !== serie) return false;
        return true;
      });

      // Extract numbers and sort
      const notasEmitidas = xmls
        .filter(xml => {
          if (!xml.numeroNota) return false;
          if (serie && xml.numeroNota) {
            // If filtering by serie, we need to check somehow
            // For now, we'll assume all notes are from the same serie
            return true;
          }
          return true;
        })
        .map(xml => ({
          numero: parseInt(xml.numeroNota || "0"),
          data: xml.dataEmissao,
          chave: xml.chave,
          id: xml.id,
        }))
        .filter(n => n.numero > 0)
        .sort((a, b) => a.numero - b.numero);

      if (notasEmitidas.length === 0) {
        return res.json({
          sequence: [],
          summary: {
            totalEmitidas: 0,
            totalInutilizadas: 0,
            totalFaltantes: 0,
            primeiroNumero: null,
            ultimoNumero: null,
          },
        });
      }

      const primeiroNumero = notasEmitidas[0].numero;
      const ultimoNumero = notasEmitidas[notasEmitidas.length - 1].numero;

      // Build sequence with gaps
      const sequence: any[] = [];
      const numerosEmitidos = new Set(notasEmitidas.map(n => n.numero));

      let i = primeiroNumero;
      while (i <= ultimoNumero) {
        if (numerosEmitidos.has(i)) {
          // Nota emitida
          const nota = notasEmitidas.find(n => n.numero === i)!;
          sequence.push({
            tipo: "emitida",
            numero: i,
            data: nota.data,
            chave: nota.chave,
            id: nota.id,
          });
          i++;
        } else {
          // Check if is inutilizada
          const inut = inutilizacoes.find(
            inutil => {
              const inicio = parseInt(inutil.numeroInicial || "0");
              const fim = parseInt(inutil.numeroFinal || "0");
              return i >= inicio && i <= fim;
            }
          );

          if (inut) {
            // Range inutilizada
            const inicio = parseInt(inut.numeroInicial || "0");
            const fim = parseInt(inut.numeroFinal || "0");
            sequence.push({
              tipo: "inutilizada",
              numeroInicio: inicio,
              numeroFim: fim,
              data: inut.dataEvento,
              justificativa: inut.justificativa,
            });
            i = fim + 1;
          } else {
            // Find range of missing numbers
            let fimFaltante = i;
            while (fimFaltante <= ultimoNumero && 
                   !numerosEmitidos.has(fimFaltante) &&
                   !inutilizacoes.some(inutil => {
                     const inicio = parseInt(inutil.numeroInicial || "0");
                     const fim = parseInt(inutil.numeroFinal || "0");
                     return fimFaltante >= inicio && fimFaltante <= fim;
                   })) {
              fimFaltante++;
            }
            fimFaltante--;

            sequence.push({
              tipo: "faltante",
              numeroInicio: i,
              numeroFim: fimFaltante,
            });
            i = fimFaltante + 1;
          }
        }
      }

      // Calculate summary
      const totalInutilizadas = sequence
        .filter(s => s.tipo === "inutilizada")
        .reduce((sum, s) => sum + (s.numeroFim - s.numeroInicio + 1), 0);

      const totalFaltantes = sequence
        .filter(s => s.tipo === "faltante")
        .reduce((sum, s) => sum + (s.numeroFim - s.numeroInicio + 1), 0);

      const inconsistencias = notasEmitidas
        .map((nota) => {
          const inut = inutilizacoes.find((inutil) => {
            const inicio = parseInt(inutil.numeroInicial || "0");
            const fim = parseInt(inutil.numeroFinal || "0");
            return nota.numero >= inicio && nota.numero <= fim;
          });
          if (!inut) return null;
          return {
            xmlId: nota.id,
            numero: nota.numero,
            chave: nota.chave,
            dataEmissao: nota.data,
            inutNumeroInicial: inut.numeroInicial,
            inutNumeroFinal: inut.numeroFinal,
            inutData: inut.dataEvento,
            inutProtocolo: inut.protocolo,
          };
        })
        .filter(Boolean);

      res.json({
        sequence,
        inconsistencias,
        summary: {
          totalEmitidas: notasEmitidas.length,
          totalInutilizadas,
          totalFaltantes,
          totalInconsistencias: inconsistencias.length,
          primeiroNumero,
          ultimoNumero,
          modelo: modelo === "55" ? "NFe" : "NFCe",
          periodo: {
            inicio: periodStart,
            fim: periodEnd,
          },
        },
      });
    } catch (error) {
      console.error("Sequence analysis error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // XML Events Routes - Eventos de NFe (Cancelamento, Carta Correção, Inutilização)
  
  // Get events by chave (all events related to a specific NFe)
  app.get("/api/xml-events/chave/:chave", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { chave } = req.params;
      
      if (!chave || chave.length !== 44) {
        return res.status(400).json({ error: "Chave de NFe inválida" });
      }

      const events = await storage.getXmlEventsByChave(chave);
      res.json(events);
    } catch (error) {
      console.error("Get events by chave error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Get events by XML ID
  app.get("/api/xml-events/xml/:xmlId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { xmlId } = req.params;
      
      const events = await storage.getXmlEventsByXmlId(xmlId);
      res.json(events);
    } catch (error) {
      console.error("Get events by XML ID error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Get events by company
  app.get("/api/xml-events/company/:companyId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId } = req.params;
      
      // Check access
      const hasAccess = await canAccessCompany(req.user!.id, companyId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const events = await storage.getXmlEventsByCompany(companyId);
      res.json(events);
    } catch (error) {
      console.error("Get events by company error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Get events by period (for email sending)
  app.get("/api/xml-events/period", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId, periodStart, periodEnd } = req.query;
      
      if (!companyId || !periodStart || !periodEnd) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      // Check access
      const hasAccess = await canAccessCompany(req.user!.id, companyId as string);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const events = await storage.getXmlEventsByPeriod(
        companyId as string,
        periodStart as string,
        periodEnd as string
      );
      res.json(events);
    } catch (error) {
      logger.error("Erro ao buscar eventos por período", error instanceof Error ? error : new Error(String(error)), {
        companyId: req.query.companyId,
        periodStart: req.query.periodStart,
        periodEnd: req.query.periodEnd,
      });
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Upload events or inutilizações
  app.post("/api/xml-events/upload", authMiddleware, upload.array("files", 50), async (req: AuthRequest, res) => {
    let cleanupPaths: string[] = [];
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      // Get user's companies
      const userCompanies = await storage.getCompaniesByUser(req.user!.id);
      if (!userCompanies || userCompanies.length === 0) {
        // Clean up files
        for (const file of files) {
          await fs.unlink(file.path).catch(() => {});
        }
        return res.status(403).json({ error: "Usuário não possui empresas vinculadas" });
      }

      const userCnpjs = new Map(userCompanies.map(c => [c.cnpj, c.id]));

      const uploadId = (req.headers["x-upload-id"] as string) || "";
      const expanded = await expandUploadedFiles(files);
      cleanupPaths = expanded.cleanupPaths;

      const results = {
        success: [] as any[],
        errors: [...expanded.errors],
        total: expanded.totalFiles,
        processed: expanded.errors.length,
      };

      if (uploadId) {
        initUploadProgress(uploadId, expanded.totalFiles, expanded.errors.length);
      }

      // Process each file
      for (const file of expanded.items) {
        results.processed++;
        
        try {
          // 1. Validate extension
          if (!file.originalname.toLowerCase().endsWith('.xml')) {
            results.errors.push({
              filename: file.originalname,
              error: "Arquivo não é XML (extensão inválida)",
              step: "validation",
            });
            await fs.unlink(file.path).catch(() => {});
            continue;
          }

          // 2. Read content
          const xmlContent = await fs.readFile(file.path, "utf-8");

          // 3. Validate if is event or inutilização XML
          if (!isValidEventXml(xmlContent)) {
            results.errors.push({
              filename: file.originalname,
              error: "Arquivo não é um XML de evento ou inutilização válido",
              step: "validation",
            });
            await fs.unlink(file.path).catch(() => {});
            continue;
          }

          // 4. Parse event or inutilização
          const parsedEvent = await parseEventOrInutilizacao(xmlContent);

          // 5. Determine company
          let companyId: string | null = null;
          const cnpj = parsedEvent.tipo === "evento" 
            ? parsedEvent.cnpj 
            : parsedEvent.cnpj;

          if (userCnpjs.has(cnpj)) {
            companyId = userCnpjs.get(cnpj)!;
          } else {
            results.errors.push({
              filename: file.originalname,
              error: `Empresa com CNPJ ${cnpj} não está vinculada ao usuário`,
              step: "authorization",
            });
            await fs.unlink(file.path).catch(() => {});
            continue;
          }

          // 6. Check duplicates before saving
          if (parsedEvent.tipo === "evento") {
            const eventoData = parsedEvent as ParsedEventoData;
            const duplicate = await storage.getDuplicateXmlEventForEvento({
              companyId,
              chaveNFe: eventoData.chaveNFe,
              tipoEvento: eventoData.tipoEvento,
              numeroSequencia: eventoData.numeroSequencia ?? null,
              protocolo: eventoData.protocolo ?? null,
              dataEvento: eventoData.dataEvento ?? null,
              horaEvento: eventoData.horaEvento ?? null,
            });
            if (duplicate) {
              results.errors.push({
                filename: file.originalname,
                error: "Evento já importado anteriormente",
                step: "duplicate",
              });
              await fs.unlink(file.path).catch(() => {});
              continue;
            }

            // Save event XML to Contabo Storage
            const saveResult = await saveEventXmlToContabo(xmlContent, parsedEvent);
            if (!saveResult.success) {
              results.errors.push({
                filename: file.originalname,
                error: saveResult.error || "Erro ao salvar evento no Contabo Storage",
                step: "storage",
              });
              await fs.unlink(file.path).catch(() => {});
              continue;
            }
            const savedPath = saveResult.filepath || "";
            
            // Find the XML by chave (if exists)
            const xml = await storage.getXmlByChave(eventoData.chaveNFe);
            
            // Create event record
            await storage.createXmlEvent({
              companyId,
              chaveNFe: eventoData.chaveNFe,
              xmlId: xml?.id || null,
              tipoEvento: eventoData.tipoEvento,
              codigoEvento: eventoData.codigoEvento,
              dataEvento: eventoData.dataEvento,
              horaEvento: eventoData.horaEvento,
              numeroSequencia: eventoData.numeroSequencia,
              protocolo: eventoData.protocolo,
              justificativa: eventoData.justificativa || null,
              correcao: eventoData.correcao || null,
              ano: null,
              serie: null,
              numeroInicial: null,
              numeroFinal: null,
              cnpj: eventoData.cnpj,
              modelo: eventoData.modelo,
              filepath: savedPath,
            });

            // If is cancelamento, update XML dataCancelamento
            if (eventoData.tipoEvento === "cancelamento" && xml) {
              await storage.updateXml(xml.id, {
                dataCancelamento: eventoData.dataEvento,
              });
            }

            results.success.push({
              filename: file.originalname,
              tipo: "evento",
              tipoEvento: eventoData.tipoEvento,
              chaveNFe: eventoData.chaveNFe,
              dataEvento: eventoData.dataEvento,
            });

          } else {
            // Inutilização
            const inutData = parsedEvent as ParsedInutilizacaoData;
            const duplicate = await storage.getDuplicateXmlEventForInutilizacao({
              companyId,
              modelo: inutData.modelo,
              serie: inutData.serie,
              numeroInicial: inutData.numeroInicial,
              numeroFinal: inutData.numeroFinal,
              protocolo: inutData.protocolo ?? null,
              dataEvento: inutData.dataEvento ?? null,
              horaEvento: inutData.horaEvento ?? null,
            });
            if (duplicate) {
              results.errors.push({
                filename: file.originalname,
                error: "Inutilização já importada anteriormente",
                step: "duplicate",
              });
              await fs.unlink(file.path).catch(() => {});
              continue;
            }

            // Save event XML to Contabo Storage
            const saveResult = await saveEventXmlToContabo(xmlContent, parsedEvent);
            if (!saveResult.success) {
              results.errors.push({
                filename: file.originalname,
                error: saveResult.error || "Erro ao salvar evento no Contabo Storage",
                step: "storage",
              });
              await fs.unlink(file.path).catch(() => {});
              continue;
            }
            const savedPath = saveResult.filepath || "";
            
            await storage.createXmlEvent({
              companyId,
              chaveNFe: null,
              xmlId: null,
              tipoEvento: "inutilizacao",
              codigoEvento: null,
              dataEvento: inutData.dataEvento,
              horaEvento: inutData.horaEvento,
              numeroSequencia: null,
              protocolo: inutData.protocolo,
              justificativa: inutData.justificativa,
              correcao: null,
              ano: inutData.ano,
              serie: inutData.serie,
              numeroInicial: inutData.numeroInicial,
              numeroFinal: inutData.numeroFinal,
              cnpj: inutData.cnpj,
              modelo: inutData.modelo,
              filepath: savedPath,
            });

            results.success.push({
              filename: file.originalname,
              tipo: "inutilizacao",
              serie: inutData.serie,
              numeroInicial: inutData.numeroInicial,
              numeroFinal: inutData.numeroFinal,
              dataEvento: inutData.dataEvento,
            });
          }

          // Clean up temp file
          await fs.unlink(file.path).catch(() => {});

        } catch (error) {
          results.errors.push({
            filename: file.originalname,
            error: error instanceof Error ? error.message : "Erro desconhecido",
            step: "processing",
          });
          await fs.unlink(file.path).catch(() => {});
        }
      }

      // Log action
      await storage.logAction({
        userId: req.user!.id,
        action: "upload_xml_events",
        details: JSON.stringify({
          total: results.total,
          success: results.success.length,
          errors: results.errors.length,
        }),
      });

      res.json(results);
    } catch (error) {
      logger.error("Erro no upload de eventos", error instanceof Error ? error : new Error(String(error)), {
        userId: req.user?.id,
        fileCount: (req.files as Express.Multer.File[])?.length || 0,
      });
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    } finally {
      const files = (req.files as Express.Multer.File[]) || [];
      const cleanupSet = new Set<string>([
        ...cleanupPaths,
        ...files.map((f) => f.path),
      ]);
      await Promise.all(
        Array.from(cleanupSet).map((p) => fs.rm(p, { recursive: true, force: true }).catch(() => {}))
      );
    }
  });

  // Alerts Routes
  
  // Get alerts for company
  app.get("/api/alerts", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId, resolved, severity, type } = req.query;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const filters: any = {};
      if (resolved !== undefined) {
        filters.resolved = resolved === "true";
      }
      if (severity) {
        filters.severity = severity;
      }
      if (type) {
        filters.type = type;
      }

      const alertsList = await storage.getAlertsByCompany(companyId as string, filters);
      res.json(alertsList);

    } catch (error) {
      console.error("Get alerts error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Resolve alert
  app.post("/api/alerts/:id/resolve", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const alert = await storage.resolveAlert(id, req.user!.id);

      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }

      await storage.logAction({
        userId: req.user!.id,
        action: "resolve_alert",
        details: JSON.stringify({ alertId: id }),
      });

      res.json(alert);

    } catch (error) {
      console.error("Resolve alert error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete alert
  app.delete("/api/alerts/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      await storage.deleteAlert(id);

      res.status(204).send();

    } catch (error) {
      console.error("Delete alert error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Email Monitors Routes - Monitoramento de Email (IMAP)
  // Scheduler toggle (admin only)
  app.get("/api/email-monitor-schedule", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const settings = await storage.getEmailMonitorScheduleSettings();
      res.json(settings || { enabled: true });
    } catch (error) {
      console.error("Get email monitor schedule error:", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      const code = (error as any)?.code;
      if (code === "42P01" || message.includes("email_monitor_schedule_settings")) {
        return res.status(500).json({
          error: "Tabela de agendamento não encontrada. Execute a migration 0003_add_email_monitor_schedule_settings.sql",
        });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/email-monitor-schedule", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Campo 'enabled' é obrigatório" });
      }

      const settings = await storage.upsertEmailMonitorScheduleSettings({ enabled });
      await storage.logAction({
        userId: req.user!.id,
        action: "email_monitor_schedule_toggle",
        details: JSON.stringify({ enabled }),
      });

      res.json(settings);
    } catch (error) {
      console.error("Update email monitor schedule error:", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      const code = (error as any)?.code;
      if (code === "42P01" || message.includes("email_monitor_schedule_settings")) {
        return res.status(500).json({
          error: "Tabela de agendamento não encontrada. Execute a migration 0003_add_email_monitor_schedule_settings.sql",
        });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Histórico de execuções do agendamento (admin only)
  app.get("/api/email-monitor-runs", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const actions = await storage.getActionsByTypesWithUser(
        ["email_monitor_schedule_run", "email_monitor_run_now"],
        dateFrom as string | undefined,
        dateTo as string | undefined
      );
      res.json(actions);
    } catch (error) {
      console.error("Get email monitor runs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get email monitors by company
  // Get all email monitors (admin only - global functionality)
  app.get("/api/email-monitors", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      // Lista todos os monitores (funcionalidade global)
      const monitors = await storage.getAllEmailMonitors();
      res.json(monitors);

    } catch (error) {
      console.error("Get email monitors error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single email monitor by ID
  app.get("/api/email-monitors/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const monitor = await storage.getEmailMonitor(id);
      
      if (!monitor) {
        return res.status(404).json({ error: "Email monitor not found" });
      }

      res.json(monitor);

    } catch (error) {
      console.error("Get email monitor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create email monitor (admin only - global functionality)
  app.post("/api/email-monitors", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { companyId, email, password, host, port, ssl, active, monitorSince, checkIntervalMinutes } = req.body;

      // companyId não é mais obrigatório (monitor é global)
      if (!email || !password || !host || !port) {
        return res.status(400).json({ error: "Email, password, host e port são obrigatórios" });
      }

      // Normalizar email (lowercase e trim)
      const normalizedEmail = email.toLowerCase().trim();

      // Verificar se email já existe
      const existingMonitor = await storage.getEmailMonitorByEmail(normalizedEmail);
      if (existingMonitor) {
        return res.status(400).json({ 
          error: "Email já cadastrado",
          message: `O email ${normalizedEmail} já está cadastrado em outro monitor.` 
        });
      }

      console.log('[Email Monitor] Criando monitor:', {
        email: normalizedEmail,
        host,
        port,
        companyId: companyId || 'NULL (global)',
        monitorSince: monitorSince || 'NULL',
        checkIntervalMinutes: checkIntervalMinutes ?? 15,
      });

      const monitor = await storage.createEmailMonitor({
        companyId: companyId || null, // Opcional - monitor é global
        email: normalizedEmail,
        password, // TODO: Encrypt password before storing
        host,
        port,
        ssl: ssl ?? true,
        active: active ?? true,
        monitorSince: monitorSince ? new Date(monitorSince) : null,
        checkIntervalMinutes: checkIntervalMinutes ?? 15,
      });

      await storage.logAction({
        userId: req.user!.id,
        action: "create_email_monitor",
        details: JSON.stringify({ monitorId: monitor.id, email, companyId: companyId || null }),
      });

      res.status(201).json(monitor);

    } catch (error) {
      console.error("Create email monitor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update email monitor
  app.put("/api/email-monitors/:id", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { email, password, host, port, ssl, active, monitorSince, checkIntervalMinutes } = req.body;

      // Verificar se monitor existe
      const existingMonitor = await storage.getEmailMonitor(id);
      if (!existingMonitor) {
        return res.status(404).json({ error: "Email monitor not found" });
      }

      // Se email está sendo alterado, verificar se não existe em outro monitor
      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        const monitorWithEmail = await storage.getEmailMonitorByEmail(normalizedEmail);
        
        // Se encontrou um monitor com esse email E não é o mesmo que está sendo editado
        if (monitorWithEmail && monitorWithEmail.id !== id) {
          return res.status(400).json({ 
            error: "Email já cadastrado",
            message: `O email ${normalizedEmail} já está cadastrado em outro monitor.` 
          });
        }
      }

      console.log('[Email Monitor] Atualizando monitor:', {
        id,
        email,
        monitorSince: monitorSince !== undefined ? (monitorSince || 'NULL') : 'não enviado',
        checkIntervalMinutes: checkIntervalMinutes !== undefined ? checkIntervalMinutes : 'não enviado',
      });

      const updateData: any = {};
      if (email) updateData.email = email.toLowerCase().trim();
      if (password) updateData.password = password; // TODO: Encrypt password
      if (host) updateData.host = host;
      if (port) updateData.port = port;
      if (ssl !== undefined) updateData.ssl = ssl;
      if (active !== undefined) updateData.active = active;
      if (monitorSince !== undefined) updateData.monitorSince = monitorSince ? new Date(monitorSince) : null;
      if (checkIntervalMinutes !== undefined) updateData.checkIntervalMinutes = checkIntervalMinutes;

      console.log('[Email Monitor] Dados a atualizar:', updateData);

      const monitor = await storage.updateEmailMonitor(id, updateData);

      if (!monitor) {
        return res.status(404).json({ error: "Email monitor not found" });
      }

      await storage.logAction({
        userId: req.user!.id,
        action: "update_email_monitor",
        details: JSON.stringify({ monitorId: id }),
      });

      res.json(monitor);

    } catch (error) {
      console.error("Update email monitor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Run all active monitors now (admin only)
  app.post("/api/email-monitors/run-now", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const result = await checkAllActiveMonitors(req.user!.id, "manual");

      await storage.logAction({
        userId: req.user!.id,
        action: "email_monitor_run_now",
        details: JSON.stringify({
          totalMonitors: result.totalMonitors,
          executed: result.executed,
          skipped: result.skipped,
          successful: result.successful,
          failed: result.failed,
        }),
      });

      res.json({
        success: true,
        data: result,
        message: `Monitores executados: ${result.executed}, pulados: ${result.skipped}, sucesso: ${result.successful}, falhas: ${result.failed}`,
      });
    } catch (error) {
      console.error("Run all monitors error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete email monitor
  app.delete("/api/email-monitors/:id", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      await storage.deleteEmailMonitor(id);

      await storage.logAction({
        userId: req.user!.id,
        action: "delete_email_monitor",
        details: JSON.stringify({ monitorId: id }),
      });

      res.status(204).send();

    } catch (error) {
      console.error("Delete email monitor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Test email monitor connection (IMAP)
  app.post("/api/email-monitors/:id/test", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const monitor = await storage.getEmailMonitor(id);
      if (!monitor) {
        return res.status(404).json({ error: "Email monitor not found" });
      }

      console.log(`[IMAP Test] Testando conexão com ${monitor.host}:${monitor.port} (SSL: ${monitor.ssl})`);
      
      // Testa conexão IMAP
      const testResult = await testImapConnection(
        monitor.host,
        monitor.port,
        monitor.ssl,
        10000 // 10 segundos timeout
      );

      if (testResult.success) {
        console.log(`[IMAP Test] ✅ Sucesso: ${testResult.message}`);
        res.json({
          success: true,
          message: testResult.message,
          details: testResult.details,
        });
      } else {
        console.log(`[IMAP Test] ❌ Falha: ${testResult.message}`);
        res.status(400).json({
          success: false,
          error: testResult.message,
          details: testResult.details,
        });
      }

    } catch (error) {
      console.error("Test email monitor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Check email monitor manually (IMAP - download XMLs)
  app.post("/api/email-monitors/:id/check", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const monitor = await storage.getEmailMonitor(id);
      if (!monitor) {
        return res.status(404).json({ error: "Monitor não encontrado" });
      }

      if (!monitor.active) {
        return res.status(400).json({ 
          error: "Monitor inativo",
          message: "Ative o monitor antes de verificar emails"
        });
      }

      console.log(`\n[IMAP Check] 🚀 Verificação manual iniciada pelo usuário ${req.user!.email}`);
      
      // Executar verificação
      const result = await checkEmailMonitor(monitor, req.user!.id);

      // Log de auditoria
      await storage.logAction({
        userId: req.user!.id,
        action: "check_email_monitor",
        details: JSON.stringify({
          monitorId: monitor.id,
          email: monitor.email,
          emailsChecked: result.emailsChecked,
          xmlsProcessed: result.xmlsProcessed,
          success: result.success,
        }),
      });

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          data: {
            emailsChecked: result.emailsChecked,
            xmlsFound: result.xmlsFound,
            xmlsProcessed: result.xmlsProcessed,
            xmlsDuplicated: result.xmlsDuplicated,
            errors: result.errors,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
          data: {
            emailsChecked: result.emailsChecked,
            errors: result.errors,
          },
        });
      }

    } catch (error) {
      console.error("[IMAP Check] ❌ Erro:", error);
      res.status(500).json({ 
        error: "Erro interno ao verificar emails",
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Email Check Logs Routes
  
  // GET /api/email-check-logs - Lista logs de verificação de email
  app.get("/api/email-check-logs", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { status, emailMonitorId, dateFrom, dateTo } = req.query;

      // Apenas admin pode ver todos os logs
      // Usuários comuns veem apenas logs das suas empresas
      const filters: any = {};

      if (status) {
        filters.status = status as string;
      }

      if (emailMonitorId) {
        filters.emailMonitorId = emailMonitorId as string;
      }

      if (dateFrom) {
        filters.dateFrom = dateFrom as string;
      }

      if (dateTo) {
        filters.dateTo = dateTo as string;
      }

      const logs = await storage.getAllEmailCheckLogs(filters);

      // Se não for admin, filtrar apenas logs das empresas do usuário
      if (user.role !== "admin") {
        const userCompanies = await storage.getCompaniesByUser(user.id);
        const companyIds = new Set(userCompanies.map(c => c.id));
        
        const filteredLogs = logs.filter(log => log.companyId && companyIds.has(log.companyId));
        return res.json(filteredLogs);
      }

      res.json(logs);

    } catch (error) {
      console.error("[Email Check Logs] ❌ Erro ao buscar logs:", error);
      res.status(500).json({ 
        error: "Erro interno ao buscar logs",
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // User Profile Routes
  
  // PUT /api/users/me - Atualiza perfil do usuário logado
  app.put("/api/users/me", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { name, email, currentPassword, newPassword } = req.body;

      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updateData: any = {};

      // Atualizar nome
      if (name && name !== user.name) {
        updateData.name = name;
      }

      // Atualizar email
      if (email && email !== user.email) {
        // Verificar se novo email já existe
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== user.id) {
          return res.status(400).json({ 
            error: "Email already exists",
            message: "Este email já está em uso por outro usuário"
          });
        }
        updateData.email = email;
      }

      // Atualizar senha
      if (currentPassword && newPassword) {
        // Validar senha atual
        const isValid = await comparePassword(currentPassword, user.passwordHash);
        if (!isValid) {
          return res.status(400).json({ 
            error: "Invalid password",
            message: "Senha atual incorreta"
          });
        }

        if (newPassword.length < 6) {
          return res.status(400).json({ 
            error: "Password too short",
            message: "A nova senha deve ter no mínimo 6 caracteres"
          });
        }

        const passwordHash = await hashPassword(newPassword);
        updateData.passwordHash = passwordHash;
      }

      // Se não há nada para atualizar
      if (Object.keys(updateData).length === 0) {
        return res.json({ 
          success: true, 
          message: "Nenhuma alteração detectada",
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }
        });
      }

      // Atualizar
      const updatedUser = await storage.updateUser(user.id, updateData);

      await storage.logAction({
        userId: user.id,
        action: "update_profile",
        details: JSON.stringify({ 
          fields: Object.keys(updateData),
          passwordChanged: !!updateData.passwordHash
        }),
      });

      res.json({ 
        success: true,
        message: "Perfil atualizado com sucesso",
        user: {
          id: updatedUser!.id,
          name: updatedUser!.name,
          email: updatedUser!.email,
          role: updatedUser!.role,
        }
      });
    } catch (error) {
      console.error("Update user profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Audit - Access Logs Routes
  
  // GET /api/audit/access-logs - Lista logs de acesso (apenas admin)
  app.get("/api/audit/access-logs", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { userId, companyId, dateFrom, dateTo } = req.query;

      const filters: any = {};
      if (userId) filters.userId = userId as string;
      if (companyId) filters.companyId = companyId as string;
      if (dateFrom) filters.dateFrom = dateFrom as string;
      if (dateTo) filters.dateTo = dateTo as string;

      console.log("[Audit Logs] Buscando logs com filtros:", filters);
      const logs = await storage.getAllAccessLogs(filters);
      console.log(`[Audit Logs] Retornando ${logs.length} registros`);
      if (logs.length > 0) {
        console.log("[Audit Logs] Primeiro registro:", {
          userId: logs[0].userId,
          userName: logs[0].userName,
          userEmail: logs[0].userEmail,
          companyId: logs[0].companyId,
          companyName: logs[0].companyName,
        });
      }
      
      res.json(logs);
    } catch (error) {
      console.error("Get access logs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/users - Lista todos os usuários (apenas admin) - para filtros
  app.get("/api/users", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const users = await storage.getAllUsers();
      console.log(`[Users API] Retornando ${users.length} usuários`);
      
      // Retorna apenas informações básicas (sem dados sensíveis)
      const usersBasic = users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        active: u.active,
      }));
      
      res.json(usersBasic);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reports / Excel Export Routes

  // Export XMLs to Excel
  app.post("/api/reports/excel", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId, tipoDoc, categoria, statusValidacao, dateFrom, dateTo, includeDetails } = req.body;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Busca XMLs com filtros
      const xmls = await storage.getXmlsByCompany(companyId, {
        tipoDoc,
        categoria,
        statusValidacao,
        dataInicio: dateFrom,
        dataFim: dateTo,
      });

      if (xmls.length === 0) {
        return res.status(404).json({ error: "No XMLs found with the specified filters" });
      }

      // Prepara opções de exportação
      const period = dateFrom && dateTo 
        ? `${dateFrom} a ${dateTo}` 
        : dateFrom 
          ? `A partir de ${dateFrom}` 
          : dateTo 
            ? `Até ${dateTo}` 
            : undefined;

      const options = {
        companyName: company.razaoSocial,
        period,
        includeDetails: includeDetails === true,
      };

      // Gera Excel
      const excelBuffer = generateXmlsExcel(xmls, options);

      // Define nome do arquivo
      const filename = generateExcelFilename(company.razaoSocial, period);

      // Registra ação
      await storage.logAction({
        userId: req.user!.id,
        action: "export_excel",
        details: JSON.stringify({
          companyId,
          xmlCount: xmls.length,
          filters: { tipoDoc, categoria, statusValidacao, dateFrom, dateTo },
        }),
      });

      // Envia arquivo
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(excelBuffer);

    } catch (error) {
      logger.error("Erro ao exportar relatório Excel", error instanceof Error ? error : new Error(String(error)), {
        userId: req.user?.id,
        companyId: req.body.companyId,
        filters: { tipoDoc: req.body.tipoDoc, categoria: req.body.categoria, statusValidacao: req.body.statusValidacao },
      });
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Export summary Excel (resumo por data)
  app.post("/api/reports/excel/summary", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId, dateFrom, dateTo } = req.body;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Busca XMLs
      const xmls = await storage.getXmlsByCompany(companyId, {
        dataInicio: dateFrom,
        dataFim: dateTo,
      });

      if (xmls.length === 0) {
        return res.status(404).json({ error: "No XMLs found" });
      }

      const period = dateFrom && dateTo ? `${dateFrom} a ${dateTo}` : undefined;

      const options = {
        companyName: company.razaoSocial,
        period,
      };

      // Gera Excel resumido
      const excelBuffer = generateSummaryExcel(xmls, options);

      const filename = `Resumo_XMLs_${company.razaoSocial.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split('T')[0]}.xlsx`;

      await storage.logAction({
        userId: req.user!.id,
        action: "export_excel_summary",
        details: JSON.stringify({ companyId, xmlCount: xmls.length }),
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(excelBuffer);

    } catch (error) {
      console.error("Summary export error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Send XMLs to accountant (ZIP file)
  app.post("/api/email/send-to-accountant", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId, accountantId, xmlIds, dateRange } = req.body;

      if (!companyId || !accountantId || !xmlIds || !Array.isArray(xmlIds)) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (xmlIds.length === 0) {
        return res.status(400).json({ error: "No XMLs selected" });
      }

      // Busca dados da empresa
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Busca dados do contador
      const accountant = await storage.getAccountant(accountantId);
      if (!accountant) {
        return res.status(404).json({ error: "Accountant not found" });
      }

      // Busca os XMLs
      const xmlsToSend = await Promise.all(
        xmlIds.map((id: string) => storage.getXml(id))
      );

      const validXmls = xmlsToSend.filter((xml): xml is NonNullable<typeof xml> => xml !== null && xml !== undefined);

      if (validXmls.length === 0) {
        return res.status(404).json({ error: "No valid XMLs found" });
      }

      // Cria arquivo ZIP em memória
      const archive = archiver("zip", { zlib: { level: 9 } });
      const zipBuffers: Buffer[] = [];

      archive.on("data", (chunk) => zipBuffers.push(chunk));

      // Adiciona cada XML ao ZIP
      for (const xml of validXmls) {
        try {
          const xmlContent = await readXmlContent(xml.filepath);
          if (xmlContent) {
            archive.append(xmlContent, { name: `NFe${xml.chave}.xml` });
          } else {
            console.error(`Erro ao ler XML ${xml.chave} para ZIP`);
          }
        } catch (error) {
          console.error(`Erro ao adicionar XML ${xml.chave} ao ZIP:`, error);
        }
      }

      // Finaliza o ZIP
      await archive.finalize();

      // Aguarda todos os chunks
      await new Promise((resolve) => {
        archive.on("end", resolve);
      });

      const zipBuffer = Buffer.concat(zipBuffers);

      // Prepara email usando template
      const emailTemplate = getXmlEmailTemplate({
        companyName: company.razaoSocial,
        xmlCount: validXmls.length,
        period: dateRange,
      });

      const emailData = {
        to: accountant.emailContador,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
        attachments: [
          {
            filename: `XMLs_${company.razaoSocial.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split('T')[0]}.zip`,
            content: zipBuffer,
          },
        ],
      };

      const globalEmailSettings = await storage.getEmailGlobalSettings();
      const sendResult = await sendEmailWithFallback(company, emailData, globalEmailSettings);

      if (!sendResult.success) {
        const isConfigError = sendResult.error?.includes("Configuração de email incompleta");
        return res.status(isConfigError ? 400 : 500).json({ 
          error: `Falha ao enviar email: ${sendResult.error}` 
        });
      }

      await storage.logAction({
        userId: req.user!.id,
        action: "send_to_accountant",
        details: JSON.stringify({ 
          companyId,
          accountantId,
          xmlCount: validXmls.length,
          to: accountant.emailContador,
          messageId: sendResult.messageId,
        }),
      });

      res.json({
        success: true,
        message: `${validXmls.length} XML(s) enviado(s) para ${accountant.emailContador}`,
        messageId: sendResult.messageId,
        xmlCount: validXmls.length,
      });

    } catch (error) {
      console.error("Send to accountant error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Dashboard Stats Route
  app.get("/api/dashboard/stats", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId } = req.query;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      // Busca todos XMLs da empresa
      const xmls = await storage.getXmlsByCompany(companyId as string);

      // Calcula estatísticas
      const totalXmls = xmls.length;
      const emitidas = xmls.filter(x => x.categoria === "emitida").length;
      const recebidas = xmls.filter(x => x.categoria === "recebida").length;

      const totalNotas = xmls.reduce((sum, xml) => {
        return sum + parseFloat(xml.totalNota || "0");
      }, 0);

      const totalImpostos = xmls.reduce((sum, xml) => {
        return sum + parseFloat(xml.totalImpostos || "0");
      }, 0);

      // XMLs por tipo
      const nfeCount = xmls.filter(x => x.tipoDoc === "NFe").length;
      const nfceCount = xmls.filter(x => x.tipoDoc === "NFCe").length;

      // XMLs recentes (últimos 5)
      const recentXmls = xmls
        .sort((a, b) => {
          const dateA = new Date(`${a.dataEmissao} ${a.hora || "00:00:00"}`);
          const dateB = new Date(`${b.dataEmissao} ${b.hora || "00:00:00"}`);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 5);

      // Volume por dia (últimos 7 dias)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split('T')[0];
      });

      const volumeByDay = last7Days.map(date => {
        const count = xmls.filter(x => x.dataEmissao === date).length;
        return { date, count };
      });

      res.json({
        totalXmls,
        emitidas,
        recebidas,
        totalNotas,
        totalImpostos,
        nfeCount,
        nfceCount,
        recentXmls,
        volumeByDay,
      });

    } catch (error) {
      logger.error("Erro ao buscar estatísticas do dashboard", error instanceof Error ? error : new Error(String(error)), {
        companyId: req.query.companyId,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // XMLs Routes
  app.get("/api/xmls", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId, tipoDoc, categoria, statusValidacao, search, tipo, dataInicio, dataFim } = req.query;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      // Buscar empresa para pegar o CNPJ
      const company = await storage.getCompany(companyId as string);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Validar e normalizar formato das datas (YYYY-MM-DD)
      let dataInicioNormalizada: string | undefined;
      let dataFimNormalizada: string | undefined;
      
      if (dataInicio) {
        const dataInicioStr = (dataInicio as string).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicioStr)) {
          return res.status(400).json({ error: "Formato de data inicial inválido. Use YYYY-MM-DD" });
        }
        dataInicioNormalizada = dataInicioStr;
      }
      
      if (dataFim) {
        const dataFimStr = (dataFim as string).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFimStr)) {
          return res.status(400).json({ error: "Formato de data final inválido. Use YYYY-MM-DD" });
        }
        dataFimNormalizada = dataFimStr;
      }

      // Buscar XMLs pelo CNPJ (emitente OU destinatário)
      let xmlList = await storage.getXmlsByCnpj(company.cnpj, {
        tipoDoc: tipoDoc as string,
        categoria: categoria as string,
        statusValidacao: statusValidacao as string,
        search: search as string,
        dataInicio: dataInicioNormalizada,
        dataFim: dataFimNormalizada,
      });

      // Aplicar filtro de tipo (EMIT ou DEST) se fornecido
      if (tipo) {
        if (tipo === 'emit') {
          xmlList = xmlList.filter(xml => xml.cnpjEmitente === company.cnpj);
        } else if (tipo === 'dest') {
          xmlList = xmlList.filter(xml => xml.cnpjDestinatario === company.cnpj);
        }
      }

      // Adicionar campo "tipo" em cada XML
      const xmlListWithTipo = xmlList.map(xml => ({
        ...xml,
        tipo: xml.cnpjEmitente === company.cnpj ? 'EMIT' : 'DEST',
      }));

      res.json(xmlListWithTipo);
    } catch (error) {
      console.error("Get XMLs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/xmls/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const xml = await storage.getXml(id);

      if (!xml) {
        return res.status(404).json({ error: "XML not found" });
      }

      res.json(xml);
    } catch (error) {
      console.error("Get XML error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get XML details with parsed data
  app.get("/api/xmls/:id/details", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const xml = await storage.getXml(id);

      if (!xml) {
        return res.status(404).json({ error: "XML not found" });
      }

      // Read and parse XML content (do sistema local ou Contabo)
      const xmlContent = await readXmlContent(xml.filepath);
      if (!xmlContent) {
        return res.status(404).json({ error: "XML file not found" });
      }
      const parsedData = await parseXmlContent(xmlContent);

      res.json({
        ...xml,
        parsedData: {
          ...parsedData,
          xmlRaw: xmlContent,
        },
      });

    } catch (error) {
      console.error("Get XML details error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Soft delete XML
  app.delete("/api/xmls/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const { id } = req.params;
      const { companyId } = req.query;

      if (!companyId || typeof companyId !== "string") {
        return res.status(400).json({ error: "Company ID é obrigatório" });
      }

      const hasAccess = await canAccessCompany(user.id, companyId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Sem acesso a esta empresa" });
      }

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      const xml = await storage.getXml(id);
      if (!xml) {
        return res.status(404).json({ error: "XML não encontrado" });
      }

      if (xml.cnpjEmitente !== company.cnpj && xml.cnpjDestinatario !== company.cnpj) {
        return res.status(403).json({ error: "XML não pertence à empresa informada" });
      }

      const deleted = await storage.softDeleteXml(id);

      await storage.logAction({
        userId: user.id,
        action: "xml_soft_delete",
        details: JSON.stringify({
          xmlId: id,
          companyId,
          chave: xml.chave,
        }),
      });

      res.json({
        success: true,
        deletedAt: deleted?.deletedAt ?? null,
      });
    } catch (error) {
      console.error("Soft delete XML error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/xmls/send-selected - Envia múltiplos XMLs selecionados por email
  app.post("/api/xmls/send-selected", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { xmlIds, to, subject, text } = req.body;
      const user = req.user!;

      // Validações
      if (!xmlIds || !Array.isArray(xmlIds) || xmlIds.length === 0) {
        return res.status(400).json({ 
          error: "Selecione pelo menos um XML para enviar" 
        });
      }

      if (!to || !subject) {
        return res.status(400).json({ 
          error: "Campos obrigatórios: to (destinatário), subject (assunto)" 
        });
      }

      // Validação de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        return res.status(400).json({ error: "Email de destino inválido" });
      }

      // Buscar XMLs
      const xmls = [];
      for (const id of xmlIds) {
        const xml = await storage.getXml(id);
        if (xml) {
          xmls.push(xml);
        }
      }

      if (xmls.length === 0) {
        return res.status(404).json({ error: "Nenhum XML válido encontrado" });
      }

      // Buscar empresa pelo CNPJ do primeiro XML (todos devem ser da mesma empresa)
      const firstXml = xmls[0];
      const company = await storage.getCompanyByCnpj(firstXml.cnpjEmitente);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Verificar se o usuário pode acessar a empresa
      if (user.role !== "admin") {
        const companies = await storage.getCompaniesByUser(user.id);
        const hasAccess = companies.some((c) => c.id === company.id);
        if (!hasAccess) {
          return res.status(403).json({ error: "Acesso negado à empresa" });
        }
      }

      // Verificar se a empresa tem configuração de email
      if (!company.emailHost || !company.emailUser || !company.emailPassword) {
        return res.status(400).json({ 
          error: "Empresa não possui configuração de email SMTP. Configure o email SMTP nas configurações da empresa." 
        });
      }

      // Função para sanitizar nome de arquivo
      const sanitizeFilename = (text: string): string => {
        return text
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // Remove acentos
          .replace(/[^a-zA-Z0-9\s]/g, "") // Remove caracteres especiais
          .replace(/\s+/g, "_") // Substitui espaços por underscore
          .toUpperCase();
      };

      // Função para formatar data para nome de arquivo (DDMMYYYY)
      const formatDateFilename = (dateStr: string): string => {
        if (!dateStr) return "";
        const [year, month, day] = dateStr.split("-");
        return `${day}${month}${year}`;
      };

      // Calcular datas inicial e final dos XMLs
      const dates = xmls.map((xml) => xml.dataEmissao).sort();
      const dataInicio = dates[0];
      const dataFim = dates[dates.length - 1];

      let attachments: Array<{ filename: string; content?: Buffer; path?: string }> = [];

      if (xmls.length <= 10) {
        // Se até 10 XMLs, enviar como anexos individuais
        for (const xml of xmls) {
          try {
            const xmlBuffer = await readXmlBuffer(xml.filepath);
            if (xmlBuffer) {
              attachments.push({
                filename: `NFe${xml.chave}.xml`,
                content: xmlBuffer,
              });
            } else {
              console.warn(`Arquivo XML não encontrado: ${xml.filepath}`);
            }
          } catch (error) {
            console.warn(`Erro ao ler arquivo XML ${xml.chave}:`, error);
          }
        }

        if (attachments.length === 0) {
          return res.status(500).json({ error: "Erro ao ler arquivos XML" });
        }
      } else {
        // Se mais de 10 XMLs, compactar em ZIP
        const xmlPaths: string[] = [];
        for (const xml of xmls) {
          try {
            const xmlPath = path.resolve(xml.filepath);
            await fs.access(xmlPath);
            xmlPaths.push(xmlPath);
          } catch (error) {
            console.warn(`Arquivo XML não encontrado: ${xml.filepath}`);
          }
        }

        if (xmlPaths.length === 0) {
          return res.status(500).json({ error: "Erro ao ler arquivos XML" });
        }

        // Gerar nome do arquivo ZIP
        const cnpj = company.cnpj;
        const razaoSocial = sanitizeFilename(company.razaoSocial);
        const dtInicio = formatDateFilename(dataInicio);
        const dtFim = formatDateFilename(dataFim);
        const zipFilename = `XMLs_${cnpj}_${razaoSocial}_${dtInicio}_A_${dtFim}.zip`;
        const zipPath = path.join("/tmp", zipFilename);

        // Criar arquivo ZIP
        await new Promise<void>((resolve, reject) => {
          const fsStream = fsSync.createWriteStream(zipPath);
          const archive = archiver("zip", {
            zlib: { level: 9 } // Máxima compressão
          });

          fsStream.on("close", () => {
            console.log(`ZIP criado: ${archive.pointer()} bytes`);
            resolve();
          });

          fsStream.on("error", (err: Error) => {
            console.error("Erro no stream do arquivo ZIP:", err);
            reject(err);
          });

          archive.on("error", (err: Error) => {
            console.error("Erro ao criar arquivo ZIP:", err);
            reject(err);
          });

          archive.pipe(fsStream);

          // Adiciona cada XML ao arquivo
          for (const xmlPath of xmlPaths) {
            const filename = path.basename(xmlPath);
            archive.file(xmlPath, { name: filename });
          }

          archive.finalize();
        });

        attachments.push({
          filename: zipFilename,
          path: zipPath,
        });
      }

      // Enviar email com XMLs em anexo
      const emailData = {
        to,
        subject,
        text: text || "Anexo Nota Fiscal",
        html: text ? `
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
            </style>
          </head>
          <body>
            ${text.replace(/\n/g, "<br>")}
          </body>
          </html>
        ` : getXmlEmailTemplate({
          companyName: company.razaoSocial,
          xmlCount: xmls.length,
        }).html,
        attachments,
      };

      const globalEmailSettings = await storage.getEmailGlobalSettings();
      const result = await sendEmailWithFallback(company, emailData, globalEmailSettings);

      if (!result.success) {
        // Remover arquivo ZIP temporário mesmo em caso de erro
        if (xmls.length > 10 && attachments[0]?.path) {
          try {
            await fs.unlink(attachments[0].path);
          } catch (err) {
            console.warn("Erro ao remover arquivo ZIP temporário:", err);
          }
        }
        const isConfigError = result.error?.includes("Configuração de email incompleta");
        return res.status(isConfigError ? 400 : 500).json({ 
          error: result.error || "Erro ao enviar email" 
        });
      }

      // Remover arquivo ZIP temporário após envio bem-sucedido
      if (xmls.length > 10 && attachments[0]?.path) {
        try {
          await fs.unlink(attachments[0].path);
        } catch (err) {
          console.warn("Erro ao remover arquivo ZIP temporário:", err);
        }
      }

      // Log de auditoria
      await storage.logAction({
        userId: user.id,
        action: "send_xml_email",
        details: JSON.stringify({
          xmlIds,
          xmlCount: xmls.length,
          companyId: company.id,
          destinationEmail: to,
          subject,
          isZipped: xmls.length > 10,
        }),
      });

      res.json({
        success: true,
        messageId: result.messageId,
        xmlCount: xmls.length,
      });
    } catch (error) {
      console.error("Send selected XMLs email error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/xmls/:id/send-email - Envia XML individual por email
  app.post("/api/xmls/:id/send-email", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { to, subject, text } = req.body;
      const user = req.user!;

      // Validações
      if (!to || !subject) {
        return res.status(400).json({ 
          error: "Campos obrigatórios: to (destinatário), subject (assunto)" 
        });
      }

      // Validação de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        return res.status(400).json({ error: "Email de destino inválido" });
      }

      // Buscar XML
      const xml = await storage.getXml(id);
      if (!xml) {
        return res.status(404).json({ error: "XML not found" });
      }

      // Buscar empresa pelo CNPJ do emitente (companyId pode ser null/deprecated)
      const company = await storage.getCompanyByCnpj(xml.cnpjEmitente);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Verificar se o usuário pode acessar a empresa
      if (user.role !== "admin") {
        const companies = await storage.getCompaniesByUser(user.id);
        const hasAccess = companies.some((c) => c.id === company.id);
        if (!hasAccess) {
          return res.status(403).json({ error: "Acesso negado à empresa" });
        }
      }

      // Verificar se a empresa tem configuração de email
      if (!company.emailHost || !company.emailUser || !company.emailPassword) {
        return res.status(400).json({ 
          error: "Empresa não possui configuração de email SMTP. Configure o email SMTP nas configurações da empresa." 
        });
      }

      // Ler arquivo XML como buffer binário (do sistema local ou Contabo)
      const xmlBuffer = await readXmlBuffer(xml.filepath);
      if (!xmlBuffer) {
        return res.status(404).json({ error: "XML file not found" });
      }

      // Enviar email com XML em anexo
      const emailData = {
        to,
        subject,
        text: text || "Anexo Nota Fiscal",
        html: text ? `
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
            </style>
          </head>
          <body>
            ${text.replace(/\n/g, "<br>")}
          </body>
          </html>
        ` : getXmlEmailTemplate({
          companyName: company.razaoSocial,
          xmlCount: 1,
        }).html,
        attachments: [
          {
            filename: `NFe${xml.chave}.xml`,
            content: xmlBuffer,
          },
        ],
      };

      const globalEmailSettings = await storage.getEmailGlobalSettings();
      const result = await sendEmailWithFallback(company, emailData, globalEmailSettings);

      if (!result.success) {
        const isConfigError = result.error?.includes("Configuração de email incompleta");
        return res.status(isConfigError ? 400 : 500).json({ 
          error: result.error || "Erro ao enviar email" 
        });
      }

      // Log de auditoria
      await storage.logAction({
        userId: user.id,
        action: "send_xml_email",
        details: JSON.stringify({
          xmlId: id,
          xmlChave: xml.chave,
          companyId: xml.companyId,
          destinationEmail: to,
          subject,
        }),
      });

      res.json({
        success: true,
        messageId: result.messageId,
      });
    } catch (error) {
      console.error("Send XML email error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Download XML by chave
  app.get("/api/xmls/:chave/download", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { chave } = req.params;

      const xml = await storage.getXmlByChave(chave);
      if (!xml) {
        return res.status(404).json({ error: "XML not found" });
      }

      // Read XML file from storage (do sistema local ou Contabo)
      const xmlContent = await readXmlContent(xml.filepath);
      if (!xmlContent) {
        return res.status(404).json({ error: "XML file not found" });
      }

      // Set headers for download
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Content-Disposition", `attachment; filename="NFe${chave}.xml"`);
      res.send(xmlContent);

      await storage.logAction({
        userId: req.user!.id,
        action: "download_xml",
        details: JSON.stringify({ chave }),
      });
    } catch (error) {
      console.error("Download XML error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Upload XMLs Route - Batch processing
  app.post("/api/upload", authMiddleware, uploadFilesMiddleware, async (req: AuthRequest, res) => {
    let cleanupPaths: string[] = [];
    try {
      const files = req.files as Express.Multer.File[];

      // Validação de arquivos
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const uploadId = (req.headers["x-upload-id"] as string) || "";

      // Busca todas as empresas do usuário para categorização
      const userCompanies = await storage.getCompaniesByUser(req.user!.id);
      const userCnpjs = new Map(userCompanies.map(c => [c.cnpj, c.id]));

      const expanded = await expandUploadedFiles(files);
      cleanupPaths = expanded.cleanupPaths;

      const results = {
        success: [] as any[],
        errors: [...expanded.errors],
        total: expanded.totalFiles,
        processed: expanded.errors.length,
      };

      if (uploadId) {
        initUploadProgress(uploadId, expanded.totalFiles, expanded.errors.length);
      }

      // Processa cada arquivo
      for (const file of expanded.items) {
        let hadError = false;
        try {
          // 1. Validação de extensão
          if (!file.originalname.toLowerCase().endsWith('.xml')) {
            hadError = true;
            results.errors.push({
              filename: file.originalname,
              error: "Arquivo não é XML (extensão inválida)",
              step: "validation",
            });
            await fs.unlink(file.path).catch(() => {});
            continue;
          }

          // 2. Leitura do conteúdo
          const xmlContent = await fs.readFile(file.path, "utf-8");

          // 3. Validação básica de estrutura XML NFe
          if (!isValidNFeXml(xmlContent)) {
            hadError = true;
            results.errors.push({
              filename: file.originalname,
              error: "Arquivo não é um XML de NFe/NFCe válido",
              step: "validation",
            });
            await fs.unlink(file.path).catch(() => {});
            continue;
          }

          // 4. Parse do XML
          let parsedXml;
          try {
            parsedXml = await parseXmlContent(xmlContent);
          } catch (parseError) {
            hadError = true;
            results.errors.push({
              filename: file.originalname,
              error: parseError instanceof Error ? parseError.message : "Erro ao parsear XML",
              step: "parse",
            });
            await fs.unlink(file.path).catch(() => {});
            continue;
          }

          // 5. Validação da chave
          if (!validateChave(parsedXml.chave)) {
            hadError = true;
            results.errors.push({
              filename: file.originalname,
              error: "Chave de acesso inválida (deve ter 44 dígitos numéricos)",
              step: "validation",
              chave: parsedXml.chave,
            });
            await fs.unlink(file.path).catch(() => {});
            continue;
          }

          // 6. Verificação de duplicata no banco de dados
          const existingInDb = await storage.getXmlByChave(parsedXml.chave);
          if (existingInDb) {
            hadError = true;
            results.errors.push({
              filename: file.originalname,
              error: "XML duplicado (chave já existe no banco de dados)",
              step: "duplicate_check",
              chave: parsedXml.chave,
            });
            await fs.unlink(file.path).catch(() => {});
            continue;
          }

          // 7. Verificação de duplicata no storage
          const existingInStorage = await storageFileExists(parsedXml.chave, "validated");
          if (existingInStorage) {
            hadError = true;
            results.errors.push({
              filename: file.originalname,
              error: "XML duplicado (arquivo já existe no storage)",
              step: "duplicate_check",
              chave: parsedXml.chave,
            });
            await fs.unlink(file.path).catch(() => {});
            continue;
          }

          // 8. Busca ou cria empresa automaticamente pelo CNPJ do emitente
          const { company: emitterCompany, wasCreated } = await getOrCreateCompanyByCnpj(
            parsedXml.cnpjEmitente,
            parsedXml,
            req.user!.id // Passa o ID do usuário para vincular automaticamente
          );

          if (wasCreated) {
            console.log(`[UPLOAD] ✨ Nova empresa criada automaticamente: ${emitterCompany.razaoSocial} (${emitterCompany.cnpj})`);
          }

          // 9. Categorização automática (emitida vs recebida)
          // A categoria é inferida com base nos CNPJs das empresas do usuário
          let categoria: "emitida" | "recebida";
          
          // Verifica se o CNPJ emitente ou destinatário pertence às empresas do usuário
          const userHasEmitter = userCnpjs.has(parsedXml.cnpjEmitente);
          const userHasReceiver = parsedXml.cnpjDestinatario && userCnpjs.has(parsedXml.cnpjDestinatario);
          
          if (userHasEmitter) {
            // Usuário é o emitente
            categoria = "emitida";
          } else if (userHasReceiver) {
            // Usuário é o destinatário
            categoria = "recebida";
          } else {
            // Usuário não é nem emitente nem destinatário
            // Considera como emitida por padrão
            categoria = "emitida";
          }

          // 10. Salva arquivo no Contabo Storage
          const saveResult = await saveXmlToContabo(xmlContent, parsedXml);
          if (!saveResult.success) {
            hadError = true;
            results.errors.push({
              filename: file.originalname,
              error: saveResult.error || "Erro ao salvar arquivo no Contabo Storage",
              step: "storage",
              chave: parsedXml.chave,
            });
            await fs.unlink(file.path).catch(() => {});
            continue;
          }

          // 11. Salva no banco de dados (sem companyId - filtragem é por CNPJ)
          const xml = await storage.createXml({
            companyId: null, // Campo deprecated - não mais usado
            chave: parsedXml.chave,
            numeroNota: parsedXml.numeroNota || null,
            tipoDoc: parsedXml.tipoDoc,
            dataEmissao: parsedXml.dataEmissao,
            hora: parsedXml.hora || "00:00:00",
            cnpjEmitente: parsedXml.cnpjEmitente,
            cnpjDestinatario: parsedXml.cnpjDestinatario || null,
            razaoSocialDestinatario: parsedXml.razaoSocialDestinatario || null,
            totalNota: parsedXml.totalNota.toString(),
            totalImpostos: parsedXml.totalImpostos.toString(),
            categoria,
            statusValidacao: "valido",
            filepath: saveResult.filepath || "",
          });

          // 12. Remove arquivo temporário
          await fs.unlink(file.path).catch(() => {});

          // 13. Adiciona ao resultado de sucesso
          results.success.push({
            filename: file.originalname,
            chave: xml.chave,
            id: xml.id,
            categoria,
            tipoDoc: xml.tipoDoc,
            totalNota: xml.totalNota,
            dataEmissao: xml.dataEmissao,
          });

        } catch (error) {
          hadError = true;
          console.error("Error processing file:", file.originalname, error);
          results.errors.push({
            filename: file.originalname,
            error: error instanceof Error ? error.message : "Erro desconhecido no processamento",
            step: "processing",
          });
          await fs.unlink(file.path).catch(() => {});
        } finally {
          results.processed += 1;
          if (uploadId) {
            bumpUploadProgress(uploadId, hadError);
          }
        }
      }

      // Log de auditoria
      await storage.logAction({
        userId: req.user!.id,
        action: "upload_xml_batch",
        details: JSON.stringify({
          total: results.total,
          successCount: results.success.length,
          errorCount: results.errors.length,
          newCompaniesCreated: results.success.filter((s: any) => s.wasCreated).length || 0,
        }),
      });

      if (uploadId) {
        completeUploadProgress(uploadId);
      }

      // Retorna resultado
      res.json({
        ...results,
        message: `Processados ${results.processed}/${results.total} arquivos. ${results.success.length} com sucesso, ${results.errors.length} com erro.`,
      });

    } catch (error) {
      console.error("Upload error:", error);
      const uploadId = (req.headers["x-upload-id"] as string) || "";
      if (uploadId) {
        completeUploadProgress(uploadId);
      }
      res.status(500).json({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      const files = (req.files as Express.Multer.File[]) || [];
      const cleanupSet = new Set<string>([
        ...cleanupPaths,
        ...files.map((f) => f.path),
      ]);
      await Promise.all(
        Array.from(cleanupSet).map((p) => fs.rm(p, { recursive: true, force: true }).catch(() => {}))
      );
    }
  });

  // Upload progress
  app.get("/api/upload/progress/:uploadId", authMiddleware, async (req: AuthRequest, res) => {
    const { uploadId } = req.params;
    const progress = uploadProgressMap.get(uploadId);
    if (!progress) {
      return res.status(404).json({ error: "Upload não encontrado" });
    }
    return res.json(progress);
  });

  // DANFE Routes - Geração de DANFE em PDF
  app.get("/api/danfe/:chave", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { chave } = req.params;

      if (!chave || chave.length !== 44) {
        return res.status(400).json({ 
          error: "Chave inválida",
          message: "A chave de acesso deve ter 44 caracteres" 
        });
      }

      // Buscar XML no banco usando storage
      const xml = await storage.getXmlByChave(chave);

      if (!xml) {
        return res.status(404).json({ 
          error: "XML não encontrado",
          message: "Não foi possível encontrar o XML para esta chave de acesso" 
        });
      }

      // Verificar permissão de acesso (baseado nos CNPJs agora)
      if (req.userRole !== "admin") {
        // Buscar empresas do usuário
        const userCompanies = await storage.getCompaniesByUser(req.userId!);
        const userCnpjs = new Set(userCompanies.map(c => c.cnpj));
        
        // Verificar se o usuário tem acesso ao emitente ou destinatário
        const hasAccess = userCnpjs.has(xml.cnpjEmitente) || 
                         (xml.cnpjDestinatario && userCnpjs.has(xml.cnpjDestinatario));

        if (!hasAccess) {
          return res.status(403).json({ 
            error: "Acesso negado",
            message: "Você não tem permissão para acessar este documento" 
          });
        }
      }

      // Usar o filepath do banco de dados
      const xmlPath = xml.filepath;
      
      // Verificar se arquivo XML existe
      try {
        await fs.access(xmlPath);
      } catch (error) {
        console.error(`[DANFE] ❌ Arquivo não encontrado: ${xmlPath}`, error);
        return res.status(404).json({ 
          error: "Arquivo não encontrado",
          message: `O arquivo XML não foi encontrado no storage: ${xmlPath}` 
        });
      }

      // Gerar DANFE (ou retornar existente)
      console.log(`[DANFE] 📄 Gerando DANFE para chave: ${chave}`);
      const pdfPath = await gerarDanfe(xmlPath);

      // Atualizar campo danfe_path no banco (se ainda não existe)
      if (!xml.danfePath) {
        await storage.updateXml(xml.id, { danfePath: path.basename(pdfPath) });
        console.log(`[DANFE] ✅ Campo danfe_path atualizado no banco`);
      }

      // Configurar headers para download
      const filename = `${chave}-DANFE.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Enviar arquivo
      res.download(pdfPath, filename, (err) => {
        if (err) {
          console.error('[DANFE] ❌ Erro ao enviar arquivo:', err);
          if (!res.headersSent) {
            res.status(500).json({ 
              error: "Erro ao baixar arquivo",
              message: "Ocorreu um erro ao tentar baixar o DANFE" 
            });
          }
        } else {
          console.log(`[DANFE] ✅ Download concluído: ${filename}`);
        }
      });

    } catch (error: any) {
      console.error('[DANFE] ❌ Erro ao gerar DANFE:', error);
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Erro ao gerar DANFE",
          message: error.message || "Ocorreu um erro ao gerar o DANFE. Verifique se o XML é válido." 
        });
      }
    }
  });

  // ========================================
  // XML EMAIL ROUTES - Envio de XMLs por Email para Contabilidade
  // ========================================

  // GET /api/xml-email/history - Busca histórico de envios de XMLs por email
  app.get("/api/xml-email/history", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const companyId = req.query.companyId as string;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID é obrigatório" });
      }

      // Verifica se o usuário pode acessar a empresa
      if (user.role !== "admin") {
        const companies = await storage.getCompaniesByUser(user.id);
        const hasAccess = companies.some((c) => c.id === companyId);
        
        if (!hasAccess) {
          return res.status(403).json({ error: "Acesso negado à empresa" });
        }
      }

      const history = await storage.getXmlEmailHistoryByCompany(companyId);
      res.json(history);
    } catch (error: any) {
      console.error("Erro ao buscar histórico de envios:", error);
      res.status(500).json({ error: "Erro ao buscar histórico de envios" });
    }
  });

  // POST /api/xml-email/send - Envia XMLs por email
  app.post("/api/xml-email/send", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { companyId, periodStart, periodEnd, destinationEmail } = req.body;

      // Validações
      if (!companyId || !periodStart || !periodEnd || !destinationEmail) {
        return res.status(400).json({ 
          error: "Campos obrigatórios: companyId, periodStart, periodEnd, destinationEmail" 
        });
      }

      // Validação de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(destinationEmail)) {
        return res.status(400).json({ error: "Email de destino inválido" });
      }

      // Validação de datas
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(periodStart) || !dateRegex.test(periodEnd)) {
        return res.status(400).json({ 
          error: "Formato de data inválido. Use YYYY-MM-DD" 
        });
      }

      if (periodStart > periodEnd) {
        return res.status(400).json({ 
          error: "Data inicial deve ser menor ou igual à data final" 
        });
      }

      // Verifica se o usuário pode acessar a empresa
      if (user.role !== "admin") {
        const companies = await storage.getCompaniesByUser(user.id);
        const hasAccess = companies.some((c) => c.id === companyId);
        
        if (!hasAccess) {
          return res.status(403).json({ error: "Acesso negado à empresa" });
        }
      }

      // Envia os XMLs por email
      const result = await sendXmlsByEmail(
        companyId,
        periodStart,
        periodEnd,
        destinationEmail
      );

      if (!result.success) {
        // Salva erro no histórico
        await storage.createXmlEmailHistory({
          companyId,
          userId: user.id,
          destinationEmail,
          periodStart,
          periodEnd,
          xmlCount: 0,
          zipFilename: "",
          emailSubject: "",
          status: "failed",
          errorMessage: result.error || "Erro desconhecido",
        });

        return res.status(500).json({ 
          error: result.error || "Erro ao enviar XMLs por email" 
        });
      }

      // Registra no histórico
      const history = await storage.createXmlEmailHistory({
        companyId,
        userId: user.id,
        destinationEmail,
        periodStart,
        periodEnd,
        xmlCount: result.xmlCount,
        zipFilename: result.zipFilename,
        emailSubject: result.emailSubject,
        status: "success",
      });

      // Log de auditoria
      await storage.logAction({
        userId: user.id,
        action: "send_xml_email",
        details: JSON.stringify({
          companyId,
          destinationEmail,
          periodStart,
          periodEnd,
          xmlCount: result.xmlCount,
          zipFilename: result.zipFilename,
        }),
      });

      res.json({
        success: true,
        message: "XMLs enviados com sucesso!",
        data: {
          xmlCount: result.xmlCount,
          zipFilename: result.zipFilename,
          emailSubject: result.emailSubject,
          history,
        },
      });
    } catch (error: any) {
      console.error("Erro ao enviar XMLs por email:", error);
      res.status(500).json({ 
        error: "Erro ao enviar XMLs por email",
        message: error.message || "Erro desconhecido"
      });
    }
  });

  // ========================================
  // CONTABO OBJECT STORAGE ROUTES
  // ========================================

  // Testar conexão com Contabo Storage
  app.get("/api/storage/test", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const result = await contaboStorage.testStorageConnection();
      
      if (result.success) {
        res.json({
          status: "ok",
          message: "Conexão com Contabo Storage funcionando!",
          details: result.details,
        });
      } else {
        res.status(500).json({
          status: "error",
          message: "Falha ao conectar com o storage",
          error: result.error,
        });
      }
    } catch (error: any) {
      console.error("Erro ao testar storage:", error);
      res.status(500).json({
        status: "error",
        message: "Erro ao testar conexão",
        error: error.message || "Erro desconhecido",
      });
    }
  });

  // Upload de XML para Contabo Storage
  app.post("/api/storage/upload-xml", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
    const tempFilePath = req.file?.path;
    
    const cleanupTempFile = async () => {
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch(() => {});
      }
    };

    try {
      const user = req.user;
      if (!user) {
        await cleanupTempFile();
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const { companyId } = req.body;
      if (!companyId) {
        await cleanupTempFile();
        return res.status(400).json({ error: "companyId é obrigatório" });
      }

      // Verificar acesso à empresa
      const hasAccess = await canAccessCompany(user.id, companyId);
      if (!hasAccess) {
        await cleanupTempFile();
        return res.status(403).json({ error: "Sem acesso a esta empresa" });
      }

      // Buscar empresa para obter CNPJ
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        await cleanupTempFile();
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      if (!company.cnpj) {
        await cleanupTempFile();
        return res.status(400).json({ error: "Empresa não possui CNPJ cadastrado" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Arquivo não enviado" });
      }

      // Ler conteúdo do arquivo
      const fileContent = await fs.readFile(file.path);
      const xmlContent = fileContent.toString('utf-8');
      
      // Extrair CNPJ do emitente do XML (prioridade sobre CNPJ da empresa)
      const cnpjFromXml = contaboStorage.extractCnpjEmitenteFromXml(xmlContent);
      const cnpjToUse = cnpjFromXml || company.cnpj;
      
      if (!cnpjToUse) {
        await cleanupTempFile();
        return res.status(400).json({ 
          error: "Não foi possível identificar o CNPJ do XML nem da empresa" 
        });
      }
      
      // Upload para Contabo Storage (extrai chaveAcesso do XML automaticamente)
      const result = await contaboStorage.uploadXmlFromFile(
        fileContent,
        cnpjToUse,
        file.originalname
      );

      // Limpar arquivo temporário
      await cleanupTempFile();

      if (!result.success) {
        return res.status(400).json({ 
          error: result.error || "Erro ao fazer upload" 
        });
      }

      // Log de auditoria
      await storage.logAction({
        userId: user.id,
        action: "storage_upload_xml",
        details: JSON.stringify({
          companyId,
          cnpj: cnpjToUse,
          cnpjFromXml: cnpjFromXml || null,
          companyCnpj: company.cnpj,
          key: result.key,
          url: result.url,
        }),
      });

      res.json({
        success: true,
        message: "XML enviado para storage com sucesso",
        data: {
          key: result.key,
          url: result.url,
        },
      });
    } catch (error: any) {
      await cleanupTempFile();
      console.error("Erro ao fazer upload para storage:", error);
      res.status(500).json({ 
        error: "Erro ao fazer upload",
        message: error.message || "Erro desconhecido"
      });
    }
  });

  // Listar XMLs de uma empresa no storage
  app.get("/api/storage/xmls/:companyId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const { companyId } = req.params;

      // Verificar acesso à empresa
      const hasAccess = await canAccessCompany(user.id, companyId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Sem acesso a esta empresa" });
      }

      // Buscar empresa para obter CNPJ
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      if (!company.cnpj) {
        return res.status(400).json({ error: "Empresa não possui CNPJ cadastrado" });
      }

      // Listar XMLs no storage
      const files = await contaboStorage.listXmlsByCompany(company.cnpj);

      res.json({
        success: true,
        cnpj: contaboStorage.sanitizeCnpj(company.cnpj),
        totalFiles: files.length,
        files: files.map(f => ({
          key: f.key,
          size: f.size,
          lastModified: f.lastModified,
          url: f.url,
          chaveAcesso: f.key.split('/').pop()?.replace('.xml', '') || '',
        })),
      });
    } catch (error: any) {
      console.error("Erro ao listar XMLs no storage:", error);
      res.status(500).json({ 
        error: "Erro ao listar XMLs",
        message: error.message || "Erro desconhecido"
      });
    }
  });

  // Obter XML do storage
  app.get("/api/storage/xml/:companyId/:chaveAcesso", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const { companyId, chaveAcesso } = req.params;

      // Verificar acesso à empresa
      const hasAccess = await canAccessCompany(user.id, companyId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Sem acesso a esta empresa" });
      }

      // Buscar empresa para obter CNPJ
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      if (!company.cnpj) {
        return res.status(400).json({ error: "Empresa não possui CNPJ cadastrado" });
      }

      // Buscar XML no storage
      const xmlContent = await contaboStorage.getXml(company.cnpj, chaveAcesso);
      
      if (!xmlContent) {
        return res.status(404).json({ error: "XML não encontrado no storage" });
      }

      res.set("Content-Type", "application/xml");
      res.set("Content-Disposition", `attachment; filename="${chaveAcesso}.xml"`);
      res.send(xmlContent);
    } catch (error: any) {
      console.error("Erro ao buscar XML do storage:", error);
      res.status(500).json({ 
        error: "Erro ao buscar XML",
        message: error.message || "Erro desconhecido"
      });
    }
  });

  // Verificar se XML existe no storage
  app.get("/api/storage/xml-exists/:companyId/:chaveAcesso", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const { companyId, chaveAcesso } = req.params;

      // Verificar acesso à empresa
      const hasAccess = await canAccessCompany(user.id, companyId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Sem acesso a esta empresa" });
      }

      // Buscar empresa para obter CNPJ
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      if (!company.cnpj) {
        return res.status(400).json({ error: "Empresa não possui CNPJ cadastrado" });
      }

      // Verificar se XML existe
      const exists = await contaboStorage.xmlExists(company.cnpj, chaveAcesso);

      res.json({
        exists,
        key: contaboStorage.getXmlKey(company.cnpj, chaveAcesso),
      });
    } catch (error: any) {
      console.error("Erro ao verificar XML:", error);
      res.status(500).json({ 
        error: "Erro ao verificar XML",
        message: error.message || "Erro desconhecido"
      });
    }
  });

  // Deletar XML do storage
  app.delete("/api/storage/xml/:companyId/:chaveAcesso", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const { companyId, chaveAcesso } = req.params;

      // Verificar se é admin
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Apenas administradores podem excluir XMLs" });
      }

      // Verificar acesso à empresa
      const hasAccess = await canAccessCompany(user.id, companyId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Sem acesso a esta empresa" });
      }

      // Buscar empresa para obter CNPJ
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      if (!company.cnpj) {
        return res.status(400).json({ error: "Empresa não possui CNPJ cadastrado" });
      }

      // Deletar XML do storage
      const deleted = await contaboStorage.deleteXml(company.cnpj, chaveAcesso);

      // Log de auditoria
      await storage.logAction({
        userId: user.id,
        action: "storage_delete_xml",
        details: JSON.stringify({
          companyId,
          cnpj: company.cnpj,
          chaveAcesso,
          deleted,
        }),
      });

      res.json({
        success: deleted,
        message: deleted ? "XML excluído com sucesso" : "Falha ao excluir XML",
      });
    } catch (error: any) {
      console.error("Erro ao excluir XML do storage:", error);
      res.status(500).json({ 
        error: "Erro ao excluir XML",
        message: error.message || "Erro desconhecido"
      });
    }
  });

  // Migrar XMLs de produção para Contabo Storage
  app.post("/api/storage/migrate-production", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const { limit, batchSize } = req.body;
      const actualLimit = limit ? parseInt(limit) : undefined;
      const actualBatchSize = batchSize ? parseInt(batchSize) : 50;

      console.log(`🚀 Iniciando migração de XMLs de produção para Contabo...`);

      // Buscar XMLs de produção (URLs)
      let xmlsToMigrate = await getXmlsToMigrate(true); // true = incluir URLs
      
      if (actualLimit && actualLimit > 0) {
        xmlsToMigrate = xmlsToMigrate.filter(x => 
          x.filepath?.startsWith('http://') || x.filepath?.startsWith('https://')
        ).slice(0, actualLimit);
      } else {
        xmlsToMigrate = xmlsToMigrate.filter(x => 
          x.filepath?.startsWith('http://') || x.filepath?.startsWith('https://')
        );
      }

      if (xmlsToMigrate.length === 0) {
        return res.json({
          success: true,
          message: "Nenhum XML de produção encontrado para migrar",
          total: 0,
          successCount: 0,
          errorCount: 0,
        });
      }

      // Migrar em batch
      const result = await migrateXmlsBatch(xmlsToMigrate, {
        dryRun: false,
        onProgress: (current, total, migrationResult) => {
          console.log(`[${current}/${total}] ${migrationResult.chave} - ${migrationResult.success ? 'OK' : migrationResult.error}`);
        },
      });

      // Log de auditoria
      await storage.logAction({
        userId: user.id,
        action: "storage_migrate_production",
        details: JSON.stringify({
          total: result.total,
          success: result.success,
          failed: result.failed,
        }),
      });

      res.json({
        success: true,
        message: `Migração concluída: ${result.success} sucesso, ${result.failed} falhas`,
        total: result.total,
        successCount: result.success,
        errorCount: result.failed,
        results: result.results,
      });
    } catch (error: any) {
      console.error("Erro ao migrar XMLs de produção:", error);
      res.status(500).json({ 
        error: "Erro ao migrar XMLs de produção",
        message: error.message || "Erro desconhecido"
      });
    }
  });

  // Escanear Contabo e reimportar XMLs faltantes no banco
  app.post("/api/storage/scan-and-import", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      console.log(`🔍 Iniciando escaneamento do Contabo Storage...`);

      // Escanear e importar XMLs faltantes
      const result = await scanContaboForMissingXmls(user.id);

      // Log de auditoria
      await storage.logAction({
        userId: user.id,
        action: "storage_scan_and_import",
        details: JSON.stringify({
          totalFiles: result.totalFiles,
          filesInStorage: result.filesInStorage,
          filesInDatabase: result.filesInDatabase,
          missingInDatabase: result.missingInDatabase,
          processed: result.processed,
          success: result.success,
          errors: result.errors,
        }),
      });

      res.json({
        success: true,
        message: `Escaneamento concluído: ${result.success} XMLs importados, ${result.errors} erros`,
        ...result,
      });
    } catch (error: any) {
      console.error("Erro ao escanear Contabo:", error);
      res.status(500).json({ 
        error: "Erro ao escanear Contabo Storage",
        message: error.message || "Erro desconhecido"
      });
    }
  });

  // Deletar todos os arquivos de uma empresa
  app.delete("/api/storage/company/:companyId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const { companyId } = req.params;

      // Verificar se é admin
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Apenas administradores podem excluir arquivos" });
      }

      // Verificar acesso à empresa
      const hasAccess = await canAccessCompany(user.id, companyId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Sem acesso a esta empresa" });
      }

      // Buscar empresa para obter CNPJ
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      if (!company.cnpj) {
        return res.status(400).json({ error: "Empresa não possui CNPJ cadastrado" });
      }

      // Deletar todos os arquivos da empresa
      const result = await contaboStorage.deleteAllByCompany(company.cnpj);

      // Log de auditoria
      await storage.logAction({
        userId: user.id,
        action: "storage_delete_company_files",
        details: JSON.stringify({
          companyId,
          cnpj: company.cnpj,
          deleted: result.deleted,
          success: result.success,
        }),
      });

      if (result.success) {
        res.json({
          success: true,
          message: `${result.deleted} arquivo(s) excluído(s) com sucesso`,
          deleted: result.deleted,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Erro ao excluir arquivos",
        });
      }
    } catch (error: any) {
      console.error("Erro ao excluir arquivos da empresa:", error);
      res.status(500).json({ 
        error: "Erro ao excluir arquivos",
        message: error.message || "Erro desconhecido"
      });
    }
  });

  // Obter URL de download assinada
  app.get("/api/storage/signed-url/:companyId/:chaveAcesso", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const { companyId, chaveAcesso } = req.params;
      const expiresIn = parseInt(req.query.expiresIn as string) || 3600;

      // Verificar acesso à empresa
      const hasAccess = await canAccessCompany(user.id, companyId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Sem acesso a esta empresa" });
      }

      // Buscar empresa para obter CNPJ
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      if (!company.cnpj) {
        return res.status(400).json({ error: "Empresa não possui CNPJ cadastrado" });
      }

      // Gerar URL assinada
      const key = contaboStorage.getXmlKey(company.cnpj, chaveAcesso);
      const signedUrl = await contaboStorage.getSignedDownloadUrl(key, expiresIn);

      if (!signedUrl) {
        return res.status(404).json({ error: "Não foi possível gerar URL assinada" });
      }

      res.json({
        success: true,
        url: signedUrl,
        expiresIn,
      });
    } catch (error: any) {
      console.error("Erro ao gerar URL assinada:", error);
      res.status(500).json({ 
        error: "Erro ao gerar URL",
        message: error.message || "Erro desconhecido"
      });
    }
  });

  // Estatísticas do storage por empresa
  app.get("/api/storage/stats/:companyId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const { companyId } = req.params;

      // Verificar acesso à empresa
      const hasAccess = await canAccessCompany(user.id, companyId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Sem acesso a esta empresa" });
      }

      // Buscar empresa para obter CNPJ
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      if (!company.cnpj) {
        return res.status(400).json({ error: "Empresa não possui CNPJ cadastrado" });
      }

      // Listar todos os arquivos da empresa
      const files = await contaboStorage.listAllByCompany(company.cnpj);
      
      const xmlFiles = files.filter(f => f.key.includes('/xmls/'));
      const imageFiles = files.filter(f => !f.key.includes('/xmls/'));

      const totalSize = files.reduce((acc, f) => acc + f.size, 0);
      const xmlSize = xmlFiles.reduce((acc, f) => acc + f.size, 0);
      const imageSize = imageFiles.reduce((acc, f) => acc + f.size, 0);

      res.json({
        success: true,
        stats: {
          cnpj: contaboStorage.sanitizeCnpj(company.cnpj),
          totalFiles: files.length,
          totalSize,
          totalSizeFormatted: formatBytes(totalSize),
          xmls: {
            count: xmlFiles.length,
            size: xmlSize,
            sizeFormatted: formatBytes(xmlSize),
          },
          images: {
            count: imageFiles.length,
            size: imageSize,
            sizeFormatted: formatBytes(imageSize),
          },
        },
      });
    } catch (error: any) {
      console.error("Erro ao buscar estatísticas:", error);
      res.status(500).json({ 
        error: "Erro ao buscar estatísticas",
        message: error.message || "Erro desconhecido"
      });
    }
  });

  // Função auxiliar para formatar bytes
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ============================================
  // ROTAS DE MIGRAÇÃO DE XMLs PARA CONTABO
  // ============================================

  // Contar XMLs que precisam ser migrados
  app.get("/api/storage/migration/count", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const count = await countXmlsToMigrate();
      res.json({
        success: true,
        count,
        message: `${count} XML(s) precisam ser migrados para o Contabo Storage`,
      });
    } catch (error: any) {
      console.error("Erro ao contar XMLs para migração:", error);
      res.status(500).json({
        error: "Erro ao contar XMLs para migração",
        message: error.message || "Erro desconhecido",
      });
    }
  });

  // Listar XMLs que precisam ser migrados (sem migrar)
  app.get("/api/storage/migration/list", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const xmls = await getXmlsToMigrate();
      res.json({
        success: true,
        count: xmls.length,
        xmls: xmls.map(xml => ({
          id: xml.id,
          chave: xml.chave,
          cnpjEmitente: xml.cnpjEmitente,
          cnpjDestinatario: xml.cnpjDestinatario,
          filepath: xml.filepath,
          dataEmissao: xml.dataEmissao,
        })),
      });
    } catch (error: any) {
      console.error("Erro ao listar XMLs para migração:", error);
      res.status(500).json({
        error: "Erro ao listar XMLs para migração",
        message: error.message || "Erro desconhecido",
      });
    }
  });

  // Executar migração (dry-run ou real)
  app.post("/api/storage/migration/run", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { dryRun = false, limit } = req.body;

      // Buscar XMLs para migrar
      let xmlsToMigrate = await getXmlsToMigrate();

      // Limitar quantidade se especificado
      if (limit && typeof limit === 'number' && limit > 0) {
        xmlsToMigrate = xmlsToMigrate.slice(0, limit);
      }

      if (xmlsToMigrate.length === 0) {
        return res.json({
          success: true,
          message: "Nenhum XML precisa ser migrado",
          result: {
            total: 0,
            success: 0,
            failed: 0,
            results: [],
          },
        });
      }

      // Executar migração
      const result = await migrateXmlsBatch(xmlsToMigrate, {
        dryRun: dryRun === true,
        onProgress: (current, total, migrationResult) => {
          console.log(
            `[Migração] ${current}/${total} - ${migrationResult.chave.substring(0, 12)}... - ${
              migrationResult.success ? '✅' : '❌'
            } ${migrationResult.error || ''}`
          );
        },
      });

      res.json({
        success: true,
        dryRun,
        message: dryRun
          ? `Simulação: ${result.success} sucesso(s), ${result.failed} falha(s) de ${result.total} XML(s)`
          : `Migração concluída: ${result.success} sucesso(s), ${result.failed} falha(s) de ${result.total} XML(s)`,
        result,
      });
    } catch (error: any) {
      console.error("Erro ao executar migração:", error);
      res.status(500).json({
        error: "Erro ao executar migração",
        message: error.message || "Erro desconhecido",
      });
    }
  });

  // Migrar um XML específico por ID
  app.post("/api/storage/migration/xml/:xmlId", authMiddleware, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { xmlId } = req.params;
      const { dryRun = false } = req.body;

      // Buscar XML
      const xml = await storage.getXml(xmlId);
      if (!xml) {
        return res.status(404).json({
          error: "XML não encontrado",
        });
      }

      if (dryRun) {
        // Modo dry-run: apenas simula
        const cnpj = xml.cnpjEmitente || xml.cnpjDestinatario;
        const isLocal = xml.filepath.startsWith('/') || xml.filepath.includes('storage/validated');
        
        return res.json({
          success: true,
          dryRun: true,
          message: "Simulação de migração",
          result: {
            success: isLocal && !!cnpj,
            xmlId: xml.id,
            chave: xml.chave,
            oldFilepath: xml.filepath,
            newFilepath: cnpj ? `${cnpj.replace(/\D/g, '')}/xml/${xml.chave}.xml` : undefined,
            error: !isLocal ? 'Já está no Contabo' : !cnpj ? 'Sem CNPJ' : undefined,
          },
        });
      }

      // Executar migração real
      const result = await migrateXmlToContabo(xml);

      if (result.success) {
        res.json({
          success: true,
          message: "XML migrado com sucesso",
          result,
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Erro ao migrar XML",
          result,
        });
      }
    } catch (error: any) {
      console.error("Erro ao migrar XML:", error);
      res.status(500).json({
        error: "Erro ao migrar XML",
        message: error.message || "Erro desconhecido",
      });
    }
  });

  // Endpoint de teste do Sentry (público - sem autenticação)
  app.get("/api/test-sentry", async (req, res) => {
    try {
      // Força um erro de teste com mensagem única e fácil de encontrar
      const testId = `TEST-${Date.now()}`;
      throw new Error(`[SENTRY-TEST-${testId}] Erro de teste do Sentry - NFe Manager - Verifique se este erro aparece no dashboard`);
    } catch (error) {
      logger.error(`[SENTRY-TEST] Erro de teste do Sentry - NFe Manager`, error as Error, {
        test: true,
        testId: `TEST-${Date.now()}`,
        endpoint: "/api/test-sentry",
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('user-agent'),
        sentryConfigured: !!process.env.SENTRY_DSN,
      });
      
      res.json({ 
        success: true,
        message: "Erro enviado para Sentry - verifique o dashboard",
        sentryConfigured: !!process.env.SENTRY_DSN,
        testId: `TEST-${Date.now()}`,
        note: "Este erro foi capturado e enviado para o Sentry. Procure por 'SENTRY-TEST' ou 'NFe Manager' no dashboard."
      });
    }
  });

  // Endpoint de teste do Sentry com autenticação (versão alternativa)
  app.get("/api/test-sentry-auth", authMiddleware, async (req: AuthRequest, res) => {
    try {
      // Força um erro de teste para verificar se o Sentry está funcionando
      throw new Error("Teste de erro para Sentry (autenticado) - Este é um erro intencional para verificar a integração");
    } catch (error) {
      logger.error("Erro de teste do Sentry (autenticado)", error as Error, {
        test: true,
        endpoint: "/api/test-sentry-auth",
        userId: req.user?.id,
        userEmail: req.user?.email,
        timestamp: new Date().toISOString(),
      });
      
      res.json({ 
        success: true,
        message: "Erro enviado para Sentry - verifique o dashboard",
        sentryConfigured: !!process.env.SENTRY_DSN,
        userId: req.user?.id,
        note: "Este erro foi capturado e enviado para o Sentry com informações do usuário. Verifique o dashboard do Sentry para ver os detalhes."
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
