import { Response, NextFunction } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import type { AuthRequest } from "../auth";

function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export async function apiKeyAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const rawKey = req.headers["x-api-key"];
    if (!rawKey || typeof rawKey !== "string") {
      return res.status(401).json({ error: "API key missing" });
    }

    const keyHash = hashApiKey(rawKey);
    const apiKey = await storage.getApiKeyByHash(keyHash);

    if (!apiKey || apiKey.revokedAt) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const company = await storage.getCompany(apiKey.companyId);
    if (!company) {
      return res.status(401).json({ error: "API key company not found" });
    }

    req.apiKey = {
      id: apiKey.id,
      companyId: apiKey.companyId,
      name: apiKey.name,
    };
    req.apiCompany = company;

    await storage.updateApiKeyLastUsed(apiKey.id);

    next();
  } catch (error) {
    console.error("Erro no apiKeyAuthMiddleware:", error);
    return res.status(500).json({ error: "API key authentication error" });
  }
}

export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = `ak_${crypto.randomBytes(32).toString("hex")}`;
  return {
    rawKey,
    keyHash: hashApiKey(rawKey),
    keyPrefix: rawKey.slice(0, 10),
  };
}
