import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authMiddleware, hashPassword, comparePassword, generateToken, type AuthRequest } from "./auth";
import { parseXmlContent, validateChave } from "./xmlParser";
import multer from "multer";
import * as fs from "fs/promises";
import * as path from "path";

// Configure multer for file uploads
const upload = multer({
  dest: "/tmp/uploads",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/xml" || file.mimetype === "application/xml" || file.originalname.endsWith(".xml")) {
      cb(null, true);
    } else {
      cb(new Error("Only XML files are allowed"));
    }
  },
});

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
      const user = await storage.createUser({
        email,
        passwordHash,
        name,
        role,
      });

      await storage.logAction({
        userId: user.id,
        action: "register",
        details: JSON.stringify({ email }),
      });

      const token = generateToken(user.id, user.email, user.role);

      res.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token,
      });
    } catch (error) {
      console.error("Registration error:", error);
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

      await storage.logAction({
        userId: user.id,
        action: "login",
        details: JSON.stringify({ email }),
      });

      const token = generateToken(user.id, user.email, user.role);

      res.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
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

  app.post("/api/companies", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const companyData = req.body;

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
      console.error("Create company error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/companies/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

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

  app.delete("/api/companies/:id", authMiddleware, async (req: AuthRequest, res) => {
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

  app.post("/api/accountants", authMiddleware, async (req: AuthRequest, res) => {
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

  app.delete("/api/accountants/:id", authMiddleware, async (req: AuthRequest, res) => {
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

  // XMLs Routes
  app.get("/api/xmls", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { companyId, tipoDoc, categoria, statusValidacao, search } = req.query;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const xmlList = await storage.getXmlsByCompany(companyId as string, {
        tipoDoc: tipoDoc as string,
        categoria: categoria as string,
        statusValidacao: statusValidacao as string,
        search: search as string,
      });

      res.json(xmlList);
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

  // Upload XMLs Route
  app.post("/api/upload", authMiddleware, upload.array("files", 100), async (req: AuthRequest, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      const { companyId } = req.body;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      const results = {
        success: [] as any[],
        errors: [] as any[],
      };

      for (const file of files) {
        try {
          // Read and parse XML
          const xmlContent = await fs.readFile(file.path, "utf-8");
          const parsedXml = await parseXmlContent(xmlContent);

          if (!parsedXml || !validateChave(parsedXml.chave)) {
            results.errors.push({
              filename: file.originalname,
              error: "Invalid XML format or missing chave",
            });
            await fs.unlink(file.path);
            continue;
          }

          // Check for duplicates
          const existing = await storage.getXmlByChave(parsedXml.chave);
          if (existing) {
            results.errors.push({
              filename: file.originalname,
              error: "Duplicate XML (chave already exists)",
            });
            await fs.unlink(file.path);
            continue;
          }

          // Determine category (emitida or recebida)
          const categoria =
            parsedXml.cnpjEmitente === company.cnpj ? "emitida" : "recebida";

          // Create storage path
          const storagePath = `/storage/validated/${parsedXml.chave}.xml`;
          const storageDir = path.dirname(storagePath);

          // Ensure directory exists
          await fs.mkdir(storageDir, { recursive: true });

          // Move file to validated storage
          await fs.rename(file.path, storagePath);

          // Save to database
          const xml = await storage.createXml({
            companyId,
            chave: parsedXml.chave,
            tipoDoc: parsedXml.tipoDoc,
            dataEmissao: parsedXml.dataEmissao,
            hora: parsedXml.hora,
            cnpjEmitente: parsedXml.cnpjEmitente,
            cnpjDestinatario: parsedXml.cnpjDestinatario || "",
            razaoSocialDestinatario: parsedXml.razaoSocialDestinatario || "",
            totalNota: parsedXml.totalNota,
            totalImpostos: parsedXml.totalImpostos || "0.00",
            categoria,
            statusValidacao: "valido",
            filepath: storagePath,
          });

          results.success.push({
            filename: file.originalname,
            chave: xml.chave,
            id: xml.id,
          });
        } catch (error) {
          console.error("Error processing file:", file.originalname, error);
          results.errors.push({
            filename: file.originalname,
            error: "Processing error",
          });
          try {
            await fs.unlink(file.path);
          } catch {}
        }
      }

      await storage.logAction({
        userId: req.user!.id,
        action: "upload_xml_batch",
        details: JSON.stringify({
          companyId,
          successCount: results.success.length,
          errorCount: results.errors.length,
        }),
      });

      res.json(results);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
