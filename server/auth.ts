import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  userId?: string;
  userRole?: string;
  userActive?: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string, email: string, role: string, active: boolean = true): string {
  return jwt.sign({ userId, email, role, active }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Busca usuário no banco para obter dados atualizados (role, active)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Atualizar last_login_at (sem await para não bloquear)
    db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))
      .execute()
      .catch(err => logger.error("Erro ao atualizar lastLoginAt", err as Error, { userId: user.id }));

    // Adicionar informações do usuário no request (compatibilidade)
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    // Adicionar campos para novos middlewares de autorização
    req.userId = user.id;
    req.userRole = user.role;
    req.userActive = user.active;

    next();
  } catch (error) {
    logger.error("Erro no authMiddleware", error instanceof Error ? error : new Error(String(error)));
    return res.status(500).json({ error: "Authentication error" });
  }
}
