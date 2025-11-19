import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { companyUsers } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Middleware de Autorização
 * Controla acesso baseado em roles e permissões
 */

// Tipos
interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userActive?: boolean;
}

/**
 * Middleware: isAdmin
 * Permite acesso APENAS para usuários com role "admin"
 * Usado em rotas de cadastro de clientes e contabilidades
 */
export function isAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Verifica se usuário está autenticado
    if (!req.userId) {
      return res.status(401).json({ 
        error: "Não autenticado",
        message: "Faça login para continuar" 
      });
    }

    // Verifica se usuário está ativo
    if (!req.userActive) {
      return res.status(403).json({
        error: "Conta inativa",
        message: "Sua conta precisa ser ativada. Verifique seu email."
      });
    }

    // Verifica se usuário é admin
    if (req.userRole !== "admin") {
      return res.status(403).json({ 
        error: "Acesso negado",
        message: "Apenas administradores podem acessar este recurso" 
      });
    }

    next();
  } catch (error) {
    console.error("Erro no middleware isAdmin:", error);
    return res.status(500).json({ error: "Erro ao verificar permissões" });
  }
}

/**
 * Middleware: canAccessCompany
 * Verifica se usuário tem permissão para acessar uma empresa específica
 * 
 * REGRAS:
 * - Admin: acesso a TODAS empresas
 * - Cliente: acesso apenas empresas vinculadas (company_users)
 * - Contabilidade: acesso empresas clientes (accountant_companies) - TODO: implementar
 * 
 * Uso: canAccessCompany('companyId') ou canAccessCompany('id') para params
 */
export function canAccessCompany(paramName: string = 'companyId') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Verifica autenticação
      if (!req.userId) {
        return res.status(401).json({ 
          error: "Não autenticado",
          message: "Faça login para continuar" 
        });
      }

      // Verifica se usuário está ativo
      if (!req.userActive) {
        return res.status(403).json({
          error: "Conta inativa",
          message: "Sua conta precisa ser ativada. Verifique seu email."
        });
      }

      // Admin tem acesso a tudo
      if (req.userRole === "admin") {
        return next();
      }

      // Busca companyId nos parâmetros, query ou body
      const companyId = req.params[paramName] || req.query[paramName] || req.body[paramName];

      if (!companyId) {
        return res.status(400).json({ 
          error: "Empresa não especificada",
          message: "ID da empresa é obrigatório" 
        });
      }

      // Verifica se usuário tem acesso à empresa
      const [access] = await db
        .select()
        .from(companyUsers)
        .where(
          and(
            eq(companyUsers.userId, req.userId),
            eq(companyUsers.companyId, companyId as string)
          )
        )
        .limit(1);

      if (!access) {
        return res.status(403).json({ 
          error: "Acesso negado",
          message: "Você não tem permissão para acessar esta empresa" 
        });
      }

      next();
    } catch (error) {
      console.error("Erro no middleware canAccessCompany:", error);
      return res.status(500).json({ error: "Erro ao verificar permissões" });
    }
  };
}

/**
 * Middleware: getUserCompanies
 * Busca todas empresas que o usuário tem acesso
 * Adiciona ao req.userCompanyIds para uso em queries
 */
export async function getUserCompanies(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    // Admin não precisa verificar (tem acesso a tudo)
    if (req.userRole === "admin") {
      (req as any).userCompanyIds = "all";
      return next();
    }

    // Busca empresas do usuário
    const companies = await db
      .select({ companyId: companyUsers.companyId })
      .from(companyUsers)
      .where(eq(companyUsers.userId, req.userId));

    if (companies.length === 0) {
      return res.status(403).json({ 
        error: "Sem acesso a empresas",
        message: "Você não está vinculado a nenhuma empresa" 
      });
    }

    (req as any).userCompanyIds = companies.map(c => c.companyId);
    next();
  } catch (error) {
    console.error("Erro no middleware getUserCompanies:", error);
    return res.status(500).json({ error: "Erro ao buscar empresas" });
  }
}

/**
 * Middleware: isActiveUser
 * Verifica se usuário está ativo (conta ativada)
 * Usado em rotas que exigem conta ativada
 */
export function isActiveUser(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  if (!req.userActive) {
    return res.status(403).json({
      error: "Conta inativa",
      message: "Sua conta precisa ser ativada. Verifique seu email ou solicite reenvio do link de ativação."
    });
  }

  next();
}

/**
 * Helper: checkUserRole
 * Verifica se usuário tem uma das roles permitidas
 * 
 * Exemplo:
 * router.get('/rota', checkUserRole(['admin', 'cliente']), handler);
 */
export function checkUserRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ 
        error: "Acesso negado",
        message: `Apenas ${allowedRoles.join(', ')} podem acessar este recurso` 
      });
    }

    next();
  };
}











