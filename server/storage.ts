import {
  users,
  companies,
  companyUsers,
  accountants,
  accountantCompanies,
  xmls,
  actions,
  type User,
  type InsertUser,
  type Company,
  type InsertCompany,
  type CompanyUser,
  type Accountant,
  type InsertAccountant,
  type Xml,
  type InsertXml,
  type Action,
  type InsertAction,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, like, or } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Companies
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByCnpj(cnpj: string): Promise<Company | undefined>;
  getAllCompanies(): Promise<Company[]>;
  getCompaniesByUser(userId: string): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<void>;
  
  // Company Users
  addUserToCompany(userId: string, companyId: string): Promise<CompanyUser>;
  removeUserFromCompany(userId: string, companyId: string): Promise<void>;
  
  // Accountants
  getAccountant(id: string): Promise<Accountant | undefined>;
  getAllAccountants(): Promise<Accountant[]>;
  createAccountant(accountant: InsertAccountant): Promise<Accountant>;
  updateAccountant(id: string, accountant: Partial<InsertAccountant>): Promise<Accountant | undefined>;
  deleteAccountant(id: string): Promise<void>;
  
  // Accountant Companies
  addCompanyToAccountant(accountantId: string, companyId: string): Promise<void>;
  removeCompanyFromAccountant(accountantId: string, companyId: string): Promise<void>;
  getAccountantCompanies(accountantId: string): Promise<Company[]>;
  
  // XMLs
  getXml(id: string): Promise<Xml | undefined>;
  getXmlByChave(chave: string): Promise<Xml | undefined>;
  getXmlsByCompany(companyId: string, filters?: XmlFilters): Promise<Xml[]>;
  createXml(xml: InsertXml): Promise<Xml>;
  updateXml(id: string, xml: Partial<InsertXml>): Promise<Xml | undefined>;
  deleteXml(id: string): Promise<void>;
  
  // Actions (Audit)
  logAction(action: InsertAction): Promise<Action>;
  getUserActions(userId: string): Promise<Action[]>;
}

export interface XmlFilters {
  tipoDoc?: string;
  categoria?: string;
  statusValidacao?: string;
  dataInicio?: string;
  dataFim?: string;
  search?: string;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Companies
  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyByCnpj(cnpj: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.cnpj, cnpj));
    return company || undefined;
  }

  async getAllCompanies(): Promise<Company[]> {
    return db.select().from(companies).orderBy(desc(companies.createdAt));
  }

  async getCompaniesByUser(userId: string): Promise<Company[]> {
    const result = await db
      .select({ company: companies })
      .from(companyUsers)
      .innerJoin(companies, eq(companyUsers.companyId, companies.id))
      .where(eq(companyUsers.userId, userId));
    
    return result.map((r) => r.company);
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(insertCompany).returning();
    return company;
  }

  async updateCompany(id: string, updateData: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set(updateData)
      .where(eq(companies.id, id))
      .returning();
    return company || undefined;
  }

  async deleteCompany(id: string): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  // Company Users
  async addUserToCompany(userId: string, companyId: string): Promise<CompanyUser> {
    const [companyUser] = await db
      .insert(companyUsers)
      .values({ userId, companyId })
      .returning();
    return companyUser;
  }

  async removeUserFromCompany(userId: string, companyId: string): Promise<void> {
    await db
      .delete(companyUsers)
      .where(
        and(
          eq(companyUsers.userId, userId),
          eq(companyUsers.companyId, companyId)
        )
      );
  }

  // Accountants
  async getAccountant(id: string): Promise<Accountant | undefined> {
    const [accountant] = await db.select().from(accountants).where(eq(accountants.id, id));
    return accountant || undefined;
  }

  async getAllAccountants(): Promise<Accountant[]> {
    return db.select().from(accountants).orderBy(desc(accountants.createdAt));
  }

  async createAccountant(insertAccountant: InsertAccountant): Promise<Accountant> {
    const [accountant] = await db.insert(accountants).values(insertAccountant).returning();
    return accountant;
  }

  async updateAccountant(id: string, updateData: Partial<InsertAccountant>): Promise<Accountant | undefined> {
    const [accountant] = await db
      .update(accountants)
      .set(updateData)
      .where(eq(accountants.id, id))
      .returning();
    return accountant || undefined;
  }

  async deleteAccountant(id: string): Promise<void> {
    await db.delete(accountants).where(eq(accountants.id, id));
  }

  // Accountant Companies
  async addCompanyToAccountant(accountantId: string, companyId: string): Promise<void> {
    await db.insert(accountantCompanies).values({ accountantId, companyId });
  }

  async removeCompanyFromAccountant(accountantId: string, companyId: string): Promise<void> {
    await db
      .delete(accountantCompanies)
      .where(
        and(
          eq(accountantCompanies.accountantId, accountantId),
          eq(accountantCompanies.companyId, companyId)
        )
      );
  }

  async getAccountantCompanies(accountantId: string): Promise<Company[]> {
    const result = await db
      .select({ company: companies })
      .from(accountantCompanies)
      .innerJoin(companies, eq(accountantCompanies.companyId, companies.id))
      .where(eq(accountantCompanies.accountantId, accountantId));
    
    return result.map((r) => r.company);
  }

  // XMLs
  async getXml(id: string): Promise<Xml | undefined> {
    const [xml] = await db.select().from(xmls).where(eq(xmls.id, id));
    return xml || undefined;
  }

  async getXmlByChave(chave: string): Promise<Xml | undefined> {
    const [xml] = await db.select().from(xmls).where(eq(xmls.chave, chave));
    return xml || undefined;
  }

  async getXmlsByCompany(companyId: string, filters?: XmlFilters): Promise<Xml[]> {
    let query = db.select().from(xmls).where(eq(xmls.companyId, companyId));

    if (filters?.tipoDoc) {
      query = query.where(eq(xmls.tipoDoc, filters.tipoDoc)) as any;
    }
    if (filters?.categoria) {
      query = query.where(eq(xmls.categoria, filters.categoria)) as any;
    }
    if (filters?.statusValidacao) {
      query = query.where(eq(xmls.statusValidacao, filters.statusValidacao)) as any;
    }
    if (filters?.search) {
      query = query.where(
        or(
          like(xmls.chave, `%${filters.search}%`),
          like(xmls.cnpjEmitente, `%${filters.search}%`),
          like(xmls.cnpjDestinatario, `%${filters.search}%`)
        )
      ) as any;
    }

    return (query as any).orderBy(desc(xmls.dataEmissao));
  }

  async createXml(insertXml: InsertXml): Promise<Xml> {
    const [xml] = await db.insert(xmls).values(insertXml).returning();
    return xml;
  }

  async updateXml(id: string, updateData: Partial<InsertXml>): Promise<Xml | undefined> {
    const [xml] = await db
      .update(xmls)
      .set(updateData)
      .where(eq(xmls.id, id))
      .returning();
    return xml || undefined;
  }

  async deleteXml(id: string): Promise<void> {
    await db.delete(xmls).where(eq(xmls.id, id));
  }

  // Actions (Audit)
  async logAction(insertAction: InsertAction): Promise<Action> {
    const [action] = await db.insert(actions).values(insertAction).returning();
    return action;
  }

  async getUserActions(userId: string): Promise<Action[]> {
    return db.select().from(actions).where(eq(actions.userId, userId)).orderBy(desc(actions.createdAt));
  }
}

export const storage = new DatabaseStorage();
