import {
  users,
  companies,
  companyUsers,
  accountants,
  accountantCompanies,
  xmls,
  xmlEvents,
  actions,
  alerts,
  emailMonitors,
  emailMonitorScheduleSettings,
  emailGlobalSettings,
  accessRequests,
  userAccessLogs,
  xmlEmailHistory,
  xmlDownloadHistory,
  emailCheckLogs,
  emailMonitorSeenUids,
  apiKeys,
  type User,
  type InsertUser,
  type Company,
  type InsertCompany,
  type CompanyUser,
  type Accountant,
  type InsertAccountant,
  type Xml,
  type InsertXml,
  type XmlEvent,
  type InsertXmlEvent,
  type XmlDownloadHistory,
  type InsertXmlDownloadHistory,
  type Action,
  type InsertAction,
  type Alert,
  type InsertAlert,
  type EmailMonitor,
  type InsertEmailMonitor,
  type EmailMonitorSeenUid,
  type InsertEmailMonitorSeenUid,
  type EmailMonitorScheduleSettings,
  type InsertEmailMonitorScheduleSettings,
  type EmailGlobalSettings,
  type InsertEmailGlobalSettings,
  type AccessRequest,
  type InsertAccessRequest,
  type UserAccessLog,
  type InsertUserAccessLog,
  type XmlEmailHistory,
  type InsertXmlEmailHistory,
  type EmailCheckLog,
  type InsertEmailCheckLog,
  type ApiKey,
  type InsertApiKey,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, like, or, gte, lte, sql, isNull, inArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(userId: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | undefined>;
  updateUserLastLogin(userId: string): Promise<void>;
  setPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  resetPassword(userId: string, passwordHash: string): Promise<void>;
  
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
  removeAllCompaniesFromAccountant(accountantId: string): Promise<void>;
  getAccountantCompanies(accountantId: string): Promise<Company[]>;
  
  // XMLs
  getXml(id: string): Promise<Xml | undefined>;
  getXmlByChave(chave: string): Promise<Xml | undefined>;
  getXmlsByCompany(companyId: string, filters?: XmlFilters): Promise<Xml[]>;
  getXmlsByCnpj(cnpj: string, filters?: XmlFilters): Promise<Xml[]>;
  getXmlsByEmissionDateRange(dateFrom: string, dateTo?: string): Promise<Xml[]>;
  createXml(xml: InsertXml): Promise<Xml>;
  updateXml(id: string, xml: Partial<InsertXml>): Promise<Xml | undefined>;
  softDeleteXml(id: string, deletedAt?: Date): Promise<Xml | undefined>;
  deleteXml(id: string): Promise<void>;
  
  // XML Events
  createXmlEvent(event: InsertXmlEvent): Promise<XmlEvent>;
  getXmlEventsByChave(chaveNFe: string): Promise<XmlEvent[]>;
  getXmlEventsByXmlId(xmlId: string): Promise<XmlEvent[]>;
  getXmlEvent(id: string): Promise<XmlEvent | undefined>;
  getXmlEventsByCompany(companyId: string): Promise<XmlEvent[]>;
  getXmlEventsByPeriod(companyId: string, periodStart: string, periodEnd: string): Promise<XmlEvent[]>;
  getDuplicateXmlEventForEvento(input: {
    companyId: string;
    chaveNFe: string;
    tipoEvento: string;
    numeroSequencia?: number | null;
    protocolo?: string | null;
    dataEvento?: string | null;
    horaEvento?: string | null;
  }): Promise<XmlEvent | undefined>;
  getDuplicateXmlEventForInutilizacao(input: {
    companyId: string;
    modelo: string;
    serie: string;
    numeroInicial: string;
    numeroFinal: string;
    protocolo?: string | null;
    dataEvento?: string | null;
    horaEvento?: string | null;
  }): Promise<XmlEvent | undefined>;
  deleteXmlEvent(id: string): Promise<void>;
  
  // Actions (Audit)
  logAction(action: InsertAction): Promise<Action>;
  getUserActions(userId: string): Promise<Action[]>;
  getActionsByTypesWithUser(
    actionTypes: string[],
    dateFrom?: string,
    dateTo?: string
  ): Promise<Array<{
    id: string;
    action: string;
    details: string | null;
    createdAt: Date;
    userId: string;
    userEmail: string | null;
    userName: string | null;
  }>>;
  
  // Alerts
  createAlert(alert: InsertAlert): Promise<Alert>;
  getAlertsByCompany(companyId: string, filters?: { resolved?: boolean; severity?: string; type?: string }): Promise<Alert[]>;
  getAlert(id: string): Promise<Alert | undefined>;
  resolveAlert(id: string, userId: string): Promise<Alert | undefined>;
  deleteAlert(id: string): Promise<void>;

  // API Keys
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  getApiKey(id: string): Promise<ApiKey | undefined>;
  getApiKeyByHash(hash: string): Promise<ApiKey | undefined>;
  getApiKeysByCompany(companyId: string): Promise<ApiKey[]>;
  updateApiKeyLastUsed(id: string): Promise<void>;
  revokeApiKey(id: string): Promise<ApiKey | undefined>;
  
  // Email Monitors
  getEmailMonitor(id: string): Promise<EmailMonitor | undefined>;
  getEmailMonitorByEmail(email: string): Promise<EmailMonitor | undefined>;
  getEmailMonitorsByCompany(companyId: string): Promise<EmailMonitor[]>;
  getAllEmailMonitors(): Promise<EmailMonitor[]>;
  getAllActiveEmailMonitors(): Promise<EmailMonitor[]>;
  createEmailMonitor(monitor: InsertEmailMonitor): Promise<EmailMonitor>;
  updateEmailMonitor(id: string, monitor: Partial<InsertEmailMonitor>): Promise<EmailMonitor | undefined>;
  deleteEmailMonitor(id: string): Promise<void>;
  updateEmailMonitorLastCheck(id: string): Promise<void>;
  getEmailMonitorSeenUids(emailMonitorId: string): Promise<EmailMonitorSeenUid[]>;
  addEmailMonitorSeenUid(entry: InsertEmailMonitorSeenUid): Promise<EmailMonitorSeenUid | undefined>;

  // Email monitor schedule settings
  getEmailMonitorScheduleSettings(): Promise<EmailMonitorScheduleSettings | undefined>;
  upsertEmailMonitorScheduleSettings(
    settings: InsertEmailMonitorScheduleSettings
  ): Promise<EmailMonitorScheduleSettings>;

  // Email Global Settings
  getEmailGlobalSettings(): Promise<EmailGlobalSettings | undefined>;
  upsertEmailGlobalSettings(settings: InsertEmailGlobalSettings): Promise<EmailGlobalSettings>;
  
  // Access Requests
  createAccessRequest(request: InsertAccessRequest): Promise<AccessRequest>;
  getAllAccessRequests(status?: string): Promise<AccessRequest[]>;
  getAccessRequest(id: string): Promise<AccessRequest | undefined>;
  updateAccessRequestStatus(id: string, status: string, reviewedBy: string): Promise<AccessRequest | undefined>;
  deleteAccessRequest(id: string): Promise<void>;
  
  // User Access Logs
  createAccessLog(log: InsertUserAccessLog): Promise<UserAccessLog>;
  updateAccessLogLogout(logId: string): Promise<void>;
  updateAccessLogCompany(logId: string, companyId: string): Promise<void>;
  getAccessLogsByUser(userId: string): Promise<UserAccessLog[]>;
  getAccessLogsByCompany(companyId: string): Promise<UserAccessLog[]>;
  getAllAccessLogs(filters?: { userId?: string; companyId?: string; dateFrom?: string; dateTo?: string }): Promise<any[]>;
  
  // XML Email History
  createXmlEmailHistory(history: InsertXmlEmailHistory): Promise<XmlEmailHistory>;
  updateXmlEmailHistory(id: string, data: Partial<InsertXmlEmailHistory>): Promise<XmlEmailHistory | undefined>;
  getXmlEmailHistoryByCompany(companyId: string): Promise<any[]>;

  // XML Download History
  createXmlDownloadHistory(history: InsertXmlDownloadHistory): Promise<XmlDownloadHistory>;
  updateXmlDownloadHistory(id: string, data: Partial<InsertXmlDownloadHistory>): Promise<XmlDownloadHistory | undefined>;
  getXmlDownloadHistoryByCompany(companyId: string): Promise<any[]>;
  getXmlDownloadHistoryById(id: string): Promise<XmlDownloadHistory | undefined>;
  getXmlsByPeriod(companyId: string, periodStart: string, periodEnd: string): Promise<Xml[]>;
  getCompanyById(companyId: string): Promise<Company | undefined>;
  
  // Email Check Logs
  createEmailCheckLog(log: InsertEmailCheckLog): Promise<EmailCheckLog>;
  updateEmailCheckLog(id: string, data: Partial<Omit<EmailCheckLog, 'id' | 'createdAt'>>): Promise<EmailCheckLog | undefined>;
  getEmailCheckLogsByMonitor(monitorId: string): Promise<EmailCheckLog[]>;
  getAllEmailCheckLogs(filters?: {
    status?: string;
    emailMonitorId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<any[]>;
}

export interface XmlFilters {
  tipoDoc?: string;
  categoria?: string;
  statusValidacao?: string;
  dataInicio?: string;
  dataFim?: string;
  search?: string;
  sortBy?: "dataEmissao" | "numeroNota" | "chave" | "totalNota";
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

  async getAllUsers(): Promise<User[]> {
    const usersList = await db.select().from(users).orderBy(users.name);
    return usersList;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    const usersList = await db.select().from(users).where(eq(users.role, role));
    return usersList;
  }

  async getUserByActivationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.activationToken, token)).limit(1);
    return user || undefined;
  }

  async activateUser(userId: string, passwordHash: string): Promise<void> {
    await db.update(users)
      .set({
        active: true,
        passwordHash,
        activationToken: null,
        activationExpiresAt: null,
      })
      .where(eq(users.id, userId));
  }

  async updateActivationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.update(users)
      .set({
        activationToken: token,
        activationExpiresAt: expiresAt,
      })
      .where(eq(users.id, userId));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(userId: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }

  async setPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({ 
        resetToken: token,
        resetExpiresAt: expiresAt
      })
      .where(eq(users.id, userId));
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.resetToken, token));
    return user || undefined;
  }

  async resetPassword(userId: string, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        passwordHash,
        resetToken: null,
        resetExpiresAt: null
      })
      .where(eq(users.id, userId));
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

  async getCompanyUsers(companyId: string): Promise<any[]> {
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        active: users.active,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(companyUsers)
      .innerJoin(users, eq(companyUsers.userId, users.id))
      .where(eq(companyUsers.companyId, companyId));
    
    return result;
  }

  async checkCompanyUserLink(userId: string, companyId: string): Promise<boolean> {
    const [link] = await db
      .select()
      .from(companyUsers)
      .where(and(eq(companyUsers.userId, userId), eq(companyUsers.companyId, companyId)))
      .limit(1);
    
    return !!link;
  }

  async linkUserToCompany(userId: string, companyId: string): Promise<void> {
    await db.insert(companyUsers).values({ userId, companyId });
  }

  async unlinkUserFromCompany(userId: string, companyId: string): Promise<void> {
    await db
      .delete(companyUsers)
      .where(and(eq(companyUsers.userId, userId), eq(companyUsers.companyId, companyId)));
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

  async removeAllCompaniesFromAccountant(accountantId: string): Promise<void> {
    await db
      .delete(accountantCompanies)
      .where(eq(accountantCompanies.accountantId, accountantId));
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
    const [xml] = await db
      .select()
      .from(xmls)
      .where(and(eq(xmls.id, id), isNull(xmls.deletedAt)));
    return xml || undefined;
  }

  async getXmlByChave(chave: string): Promise<Xml | undefined> {
    const [xml] = await db
      .select()
      .from(xmls)
      .where(and(eq(xmls.chave, chave), isNull(xmls.deletedAt)));
    return xml || undefined;
  }

  async getXmlsByCompany(companyId: string, filters?: XmlFilters): Promise<Xml[]> {
    // Busca a empresa para obter o CNPJ
    const company = await this.getCompany(companyId);
    if (!company) {
      return [];
    }

    // Monta condições de filtro
    const conditions: any[] = [
      or(
        eq(xmls.cnpjEmitente, company.cnpj),
        eq(xmls.cnpjDestinatario, company.cnpj)
      ),
      isNull(xmls.deletedAt),
    ];

    if (filters?.tipoDoc) {
      conditions.push(eq(xmls.tipoDoc, filters.tipoDoc));
    }
    if (filters?.categoria) {
      conditions.push(eq(xmls.categoria, filters.categoria));
    }
    if (filters?.statusValidacao) {
      conditions.push(eq(xmls.statusValidacao, filters.statusValidacao));
    }
    if (filters?.dataInicio) {
      // Garantir que dataInicio está no formato YYYY-MM-DD e validar
      const dataInicio = filters.dataInicio.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
        conditions.push(gte(xmls.dataEmissao, dataInicio));
      }
    }
    if (filters?.dataFim) {
      // Garantir que dataFim está no formato YYYY-MM-DD e validar
      const dataFim = filters.dataFim.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        conditions.push(lte(xmls.dataEmissao, dataFim));
      }
    }
    if (filters?.search) {
      conditions.push(
        or(
          like(xmls.chave, `%${filters.search}%`),
          like(xmls.numeroNota, `%${filters.search}%`),
          like(xmls.cnpjEmitente, `%${filters.search}%`),
          like(xmls.cnpjDestinatario, `%${filters.search}%`),
          like(xmls.razaoSocialDestinatario, `%${filters.search}%`)
        )
      );
    }

    const query = db.select().from(xmls).where(and(...conditions));
    const sortBy = filters?.sortBy || "dataEmissao";
    if (sortBy === "numeroNota") {
      return query.orderBy(
        asc(sql`NULLIF(${xmls.numeroNota}, '')::BIGINT`),
        asc(xmls.dataEmissao)
      );
    }
    if (sortBy === "chave") {
      return query.orderBy(asc(xmls.chave));
    }
    if (sortBy === "totalNota") {
      return query.orderBy(
        desc(sql`CAST(${xmls.totalNota} AS DECIMAL)`),
        desc(xmls.dataEmissao)
      );
    }
    return query.orderBy(desc(xmls.dataEmissao), desc(xmls.hora));
  }

  async getXmlsByCnpj(cnpj: string, filters?: XmlFilters): Promise<Xml[]> {
    // Busca XMLs onde o CNPJ é emitente OU destinatário
    const whereCondition = or(
      eq(xmls.cnpjEmitente, cnpj),
      eq(xmls.cnpjDestinatario, cnpj)
    );

    // Aplicar filtros adicionais
    const conditions = [whereCondition, isNull(xmls.deletedAt)];

    if (filters?.tipoDoc) {
      conditions.push(eq(xmls.tipoDoc, filters.tipoDoc));
    }
    if (filters?.categoria) {
      conditions.push(eq(xmls.categoria, filters.categoria));
    }
    if (filters?.statusValidacao) {
      conditions.push(eq(xmls.statusValidacao, filters.statusValidacao));
    }
    if (filters?.dataInicio) {
      // Garantir que dataInicio está no formato YYYY-MM-DD e validar
      const dataInicio = filters.dataInicio.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
        conditions.push(gte(xmls.dataEmissao, dataInicio));
      }
    }
    if (filters?.dataFim) {
      // Garantir que dataFim está no formato YYYY-MM-DD e validar
      const dataFim = filters.dataFim.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        conditions.push(lte(xmls.dataEmissao, dataFim));
      }
    }
    if (filters?.search) {
      conditions.push(
        or(
          like(xmls.chave, `%${filters.search}%`),
          like(xmls.numeroNota, `%${filters.search}%`),
          like(xmls.cnpjEmitente, `%${filters.search}%`),
          like(xmls.cnpjDestinatario, `%${filters.search}%`),
          like(xmls.razaoSocialDestinatario, `%${filters.search}%`)
        )
      );
    }

    const query = db.select().from(xmls).where(and(...conditions));
    const sortBy = filters?.sortBy || "dataEmissao";
    if (sortBy === "numeroNota") {
      return query.orderBy(
        asc(sql`NULLIF(${xmls.numeroNota}, '')::BIGINT`),
        asc(xmls.dataEmissao)
      );
    }
    if (sortBy === "chave") {
      return query.orderBy(asc(xmls.chave));
    }
    if (sortBy === "totalNota") {
      return query.orderBy(
        desc(sql`CAST(${xmls.totalNota} AS DECIMAL)`),
        desc(xmls.dataEmissao)
      );
    }
    return query.orderBy(desc(xmls.dataEmissao), desc(xmls.hora));
  }

  async getXmlsByEmissionDateRange(dateFrom: string, dateTo?: string): Promise<Xml[]> {
    const conditions = [isNull(xmls.deletedAt), gte(xmls.dataEmissao, dateFrom)];
    if (dateTo) {
      conditions.push(lte(xmls.dataEmissao, dateTo));
    }
    return await db
      .select()
      .from(xmls)
      .where(and(...conditions))
      .orderBy(desc(xmls.dataEmissao));
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

  async softDeleteXml(id: string, deletedAt: Date = new Date()): Promise<Xml | undefined> {
    const [xml] = await db
      .update(xmls)
      .set({ deletedAt })
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

  async getActionsByTypesWithUser(
    actionTypes: string[],
    dateFrom?: string,
    dateTo?: string
  ) {
    const conditions = [inArray(actions.action, actionTypes)];

    if (dateFrom) {
      conditions.push(gte(actions.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(actions.createdAt, endDate));
    }

    const rows = await db
      .select({
        id: actions.id,
        action: actions.action,
        details: actions.details,
        createdAt: actions.createdAt,
        userId: actions.userId,
        userEmail: users.email,
        userName: users.name,
      })
      .from(actions)
      .leftJoin(users, eq(actions.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(actions.createdAt));

    return rows;
  }

  // Alerts
  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const [alert] = await db.insert(alerts).values(insertAlert).returning();
    return alert;
  }

  async getAlertsByCompany(
    companyId: string,
    filters?: { resolved?: boolean; severity?: string; type?: string }
  ): Promise<Alert[]> {
    let query = db.select().from(alerts).where(eq(alerts.companyId, companyId));

    const conditions = [eq(alerts.companyId, companyId)];

    if (filters?.resolved !== undefined) {
      conditions.push(eq(alerts.resolved, filters.resolved));
    }

    if (filters?.severity) {
      conditions.push(eq(alerts.severity, filters.severity));
    }

    if (filters?.type) {
      conditions.push(eq(alerts.type, filters.type));
    }

    if (conditions.length > 1) {
      query = db.select().from(alerts).where(and(...conditions));
    }

    const results = await query.orderBy(desc(alerts.createdAt));
    return results;
  }

  async getAlert(id: string): Promise<Alert | undefined> {
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, id));
    return alert || undefined;
  }

  async resolveAlert(id: string, userId: string): Promise<Alert | undefined> {
    const [alert] = await db
      .update(alerts)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: userId,
      })
      .where(eq(alerts.id, id))
      .returning();
    return alert || undefined;
  }

  async deleteAlert(id: string): Promise<void> {
    await db.delete(alerts).where(eq(alerts.id, id));
  }

  // API Keys
  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const [created] = await db.insert(apiKeys).values(apiKey).returning();
    return created;
  }

  async getApiKey(id: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return key || undefined;
  }

  async getApiKeyByHash(hash: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash));
    return key || undefined;
  }

  async getApiKeysByCompany(companyId: string): Promise<ApiKey[]> {
    return db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.companyId, companyId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  async revokeApiKey(id: string): Promise<ApiKey | undefined> {
    const [key] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .returning();
    return key || undefined;
  }

  // Email Monitors
  async getEmailMonitor(id: string): Promise<EmailMonitor | undefined> {
    const [monitor] = await db.select().from(emailMonitors).where(eq(emailMonitors.id, id));
    return monitor || undefined;
  }

  async getEmailMonitorsByCompany(companyId: string): Promise<EmailMonitor[]> {
    return await db
      .select()
      .from(emailMonitors)
      .where(eq(emailMonitors.companyId, companyId))
      .orderBy(desc(emailMonitors.createdAt));
  }

  async getAllEmailMonitors(): Promise<EmailMonitor[]> {
    return await db
      .select()
      .from(emailMonitors)
      .orderBy(desc(emailMonitors.createdAt));
  }

  async getAllActiveEmailMonitors(): Promise<EmailMonitor[]> {
    return await db
      .select()
      .from(emailMonitors)
      .where(eq(emailMonitors.active, true))
      .orderBy(desc(emailMonitors.createdAt));
  }

  async getEmailMonitorByEmail(email: string): Promise<EmailMonitor | undefined> {
    const [monitor] = await db
      .select()
      .from(emailMonitors)
      .where(eq(emailMonitors.email, email.toLowerCase().trim()))
      .limit(1);
    return monitor || undefined;
  }

  async createEmailMonitor(monitor: InsertEmailMonitor): Promise<EmailMonitor> {
    const [newMonitor] = await db
      .insert(emailMonitors)
      .values(monitor)
      .returning();
    return newMonitor;
  }

  async updateEmailMonitor(id: string, monitor: Partial<InsertEmailMonitor>): Promise<EmailMonitor | undefined> {
    const [updated] = await db
      .update(emailMonitors)
      .set({ ...monitor, updatedAt: new Date() })
      .where(eq(emailMonitors.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteEmailMonitor(id: string): Promise<void> {
    await db.delete(emailMonitors).where(eq(emailMonitors.id, id));
  }

  async updateEmailMonitorLastCheck(id: string): Promise<void> {
    await db
      .update(emailMonitors)
      .set({ lastCheckedAt: new Date() })
      .where(eq(emailMonitors.id, id));
  }

  async getEmailMonitorSeenUids(emailMonitorId: string): Promise<EmailMonitorSeenUid[]> {
    return await db
      .select()
      .from(emailMonitorSeenUids)
      .where(eq(emailMonitorSeenUids.emailMonitorId, emailMonitorId));
  }

  async addEmailMonitorSeenUid(entry: InsertEmailMonitorSeenUid): Promise<EmailMonitorSeenUid | undefined> {
    const [created] = await db
      .insert(emailMonitorSeenUids)
      .values(entry)
      .onConflictDoNothing()
      .returning();
    return created || undefined;
  }

  async getEmailMonitorScheduleSettings(): Promise<EmailMonitorScheduleSettings | undefined> {
    const [settings] = await db.select().from(emailMonitorScheduleSettings).limit(1);
    return settings || undefined;
  }

  async upsertEmailMonitorScheduleSettings(
    settings: InsertEmailMonitorScheduleSettings
  ): Promise<EmailMonitorScheduleSettings> {
    const [existing] = await db.select().from(emailMonitorScheduleSettings).limit(1);

    if (existing) {
      const [updated] = await db
        .update(emailMonitorScheduleSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(emailMonitorScheduleSettings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(emailMonitorScheduleSettings).values(settings).returning();
    return created;
  }

  async getEmailGlobalSettings(): Promise<EmailGlobalSettings | undefined> {
    const [settings] = await db.select().from(emailGlobalSettings).limit(1);
    return settings || undefined;
  }

  async upsertEmailGlobalSettings(settings: InsertEmailGlobalSettings): Promise<EmailGlobalSettings> {
    const [existing] = await db.select().from(emailGlobalSettings).limit(1);

    if (existing) {
      const [updated] = await db
        .update(emailGlobalSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(emailGlobalSettings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(emailGlobalSettings).values(settings).returning();
    return created;
  }

  // Access Requests
  async createAccessRequest(request: InsertAccessRequest): Promise<AccessRequest> {
    const [newRequest] = await db
      .insert(accessRequests)
      .values(request)
      .returning();
    return newRequest;
  }

  async getAllAccessRequests(status?: string): Promise<AccessRequest[]> {
    if (status) {
      return await db
        .select()
        .from(accessRequests)
        .where(eq(accessRequests.status, status))
        .orderBy(desc(accessRequests.createdAt));
    }
    return await db
      .select()
      .from(accessRequests)
      .orderBy(desc(accessRequests.createdAt));
  }

  async getAccessRequest(id: string): Promise<AccessRequest | undefined> {
    const [request] = await db.select().from(accessRequests).where(eq(accessRequests.id, id));
    return request || undefined;
  }

  async updateAccessRequestStatus(id: string, status: string, reviewedBy: string): Promise<AccessRequest | undefined> {
    const [updated] = await db
      .update(accessRequests)
      .set({ 
        status,
        reviewedBy,
        reviewedAt: new Date()
      })
      .where(eq(accessRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteAccessRequest(id: string): Promise<void> {
    await db.delete(accessRequests).where(eq(accessRequests.id, id));
  }

  // User Access Logs
  async createAccessLog(log: InsertUserAccessLog): Promise<UserAccessLog> {
    const [newLog] = await db
      .insert(userAccessLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async updateAccessLogLogout(logId: string): Promise<void> {
    await db
      .update(userAccessLogs)
      .set({ logoutAt: new Date() })
      .where(eq(userAccessLogs.id, logId));
  }

  async updateAccessLogCompany(logId: string, companyId: string): Promise<void> {
    await db
      .update(userAccessLogs)
      .set({ companyId })
      .where(eq(userAccessLogs.id, logId));
  }

  async getAccessLogsByUser(userId: string): Promise<UserAccessLog[]> {
    return await db
      .select()
      .from(userAccessLogs)
      .where(eq(userAccessLogs.userId, userId))
      .orderBy(desc(userAccessLogs.createdAt));
  }

  async getAccessLogsByCompany(companyId: string): Promise<UserAccessLog[]> {
    return await db
      .select()
      .from(userAccessLogs)
      .where(eq(userAccessLogs.companyId, companyId))
      .orderBy(desc(userAccessLogs.createdAt));
  }

  async getAllAccessLogs(filters?: { userId?: string; companyId?: string; dateFrom?: string; dateTo?: string }): Promise<any[]> {
    let query = db
      .select({
        id: userAccessLogs.id,
        userId: userAccessLogs.userId,
        companyId: userAccessLogs.companyId,
        loginAt: userAccessLogs.loginAt,
        logoutAt: userAccessLogs.logoutAt,
        switchedCompanyAt: userAccessLogs.switchedCompanyAt,
        ipAddress: userAccessLogs.ipAddress,
        userAgent: userAccessLogs.userAgent,
        createdAt: userAccessLogs.createdAt,
        // Informações do usuário
        userEmail: users.email,
        userName: users.name,
        // Informações da empresa
        companyName: companies.razaoSocial,
        companyCnpj: companies.cnpj,
      })
      .from(userAccessLogs)
      .leftJoin(users, eq(userAccessLogs.userId, users.id))
      .leftJoin(companies, eq(userAccessLogs.companyId, companies.id));

    const conditions = [];
    
    if (filters?.userId) {
      conditions.push(eq(userAccessLogs.userId, filters.userId));
    }
    
    if (filters?.companyId) {
      conditions.push(eq(userAccessLogs.companyId, filters.companyId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await (query as any).orderBy(desc(userAccessLogs.createdAt));
  }

  // XML Email History methods
  async createXmlEmailHistory(history: InsertXmlEmailHistory): Promise<XmlEmailHistory> {
    const [created] = await db.insert(xmlEmailHistory).values(history).returning();
    return created;
  }

  async updateXmlEmailHistory(
    id: string,
    data: Partial<InsertXmlEmailHistory>
  ): Promise<XmlEmailHistory | undefined> {
    const [updated] = await db
      .update(xmlEmailHistory)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(xmlEmailHistory.id, id))
      .returning();
    return updated || undefined;
  }

  async getXmlEmailHistoryByCompany(companyId: string): Promise<any[]> {
    const results = await db
      .select({
        id: xmlEmailHistory.id,
        companyId: xmlEmailHistory.companyId,
        userId: xmlEmailHistory.userId,
        destinationEmail: xmlEmailHistory.destinationEmail,
        periodStart: xmlEmailHistory.periodStart,
        periodEnd: xmlEmailHistory.periodEnd,
        xmlCount: xmlEmailHistory.xmlCount,
        zipFilename: xmlEmailHistory.zipFilename,
        emailSubject: xmlEmailHistory.emailSubject,
        status: xmlEmailHistory.status,
        currentStage: xmlEmailHistory.currentStage,
        lastMessage: xmlEmailHistory.lastMessage,
        progressUpdatedAt: xmlEmailHistory.progressUpdatedAt,
        errorMessage: xmlEmailHistory.errorMessage,
        errorDetails: xmlEmailHistory.errorDetails,
        errorStack: xmlEmailHistory.errorStack,
        createdAt: xmlEmailHistory.createdAt,
        updatedAt: xmlEmailHistory.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(xmlEmailHistory)
      .leftJoin(users, eq(xmlEmailHistory.userId, users.id))
      .where(eq(xmlEmailHistory.companyId, companyId))
      .orderBy(desc(xmlEmailHistory.createdAt));
    
    return results;
  }

  // XML Download History methods
  async createXmlDownloadHistory(history: InsertXmlDownloadHistory): Promise<XmlDownloadHistory> {
    const [created] = await db.insert(xmlDownloadHistory).values(history).returning();
    return created;
  }

  async updateXmlDownloadHistory(
    id: string,
    data: Partial<InsertXmlDownloadHistory>
  ): Promise<XmlDownloadHistory | undefined> {
    const [updated] = await db
      .update(xmlDownloadHistory)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(xmlDownloadHistory.id, id))
      .returning();
    return updated || undefined;
  }

  async getXmlDownloadHistoryByCompany(companyId: string): Promise<any[]> {
    const results = await db
      .select({
        id: xmlDownloadHistory.id,
        companyId: xmlDownloadHistory.companyId,
        userId: xmlDownloadHistory.userId,
        periodStart: xmlDownloadHistory.periodStart,
        periodEnd: xmlDownloadHistory.periodEnd,
        includeNfe: xmlDownloadHistory.includeNfe,
        includeNfce: xmlDownloadHistory.includeNfce,
        includeEvents: xmlDownloadHistory.includeEvents,
        status: xmlDownloadHistory.status,
        currentStage: xmlDownloadHistory.currentStage,
        lastMessage: xmlDownloadHistory.lastMessage,
        progressUpdatedAt: xmlDownloadHistory.progressUpdatedAt,
        errorMessage: xmlDownloadHistory.errorMessage,
        errorDetails: xmlDownloadHistory.errorDetails,
        errorStack: xmlDownloadHistory.errorStack,
        zipNfePath: xmlDownloadHistory.zipNfePath,
        zipNfcePath: xmlDownloadHistory.zipNfcePath,
        zipEventsPath: xmlDownloadHistory.zipEventsPath,
        nfeCount: xmlDownloadHistory.nfeCount,
        nfceCount: xmlDownloadHistory.nfceCount,
        eventCount: xmlDownloadHistory.eventCount,
        createdAt: xmlDownloadHistory.createdAt,
        updatedAt: xmlDownloadHistory.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(xmlDownloadHistory)
      .leftJoin(users, eq(xmlDownloadHistory.userId, users.id))
      .where(eq(xmlDownloadHistory.companyId, companyId))
      .orderBy(desc(xmlDownloadHistory.createdAt));

    return results;
  }

  async getXmlDownloadHistoryById(id: string): Promise<XmlDownloadHistory | undefined> {
    const [result] = await db
      .select()
      .from(xmlDownloadHistory)
      .where(eq(xmlDownloadHistory.id, id));
    return result || undefined;
  }

  async getXmlsByPeriod(companyId: string, periodStart: string, periodEnd: string): Promise<Xml[]> {
    // Busca a empresa para obter o CNPJ
    const company = await this.getCompany(companyId);
    if (!company) {
      return [];
    }

    // Busca XMLs onde a empresa é emitente OU destinatária
    const results = await db
      .select()
      .from(xmls)
      .where(
        and(
          or(
            eq(xmls.cnpjEmitente, company.cnpj),
            eq(xmls.cnpjDestinatario, company.cnpj)
          ),
          isNull(xmls.deletedAt),
          gte(xmls.dataEmissao, periodStart),
          lte(xmls.dataEmissao, periodEnd)
        )
      )
      .orderBy(desc(xmls.dataEmissao));

    return results;
  }

  async getCompanyById(companyId: string): Promise<Company | undefined> {
    return this.getCompany(companyId);
  }

  // XML Events methods
  async createXmlEvent(event: InsertXmlEvent): Promise<XmlEvent> {
    const [created] = await db.insert(xmlEvents).values(event).returning();
    return created;
  }

  async getXmlEventsByChave(chaveNFe: string): Promise<XmlEvent[]> {
    return await db
      .select()
      .from(xmlEvents)
      .where(eq(xmlEvents.chaveNFe, chaveNFe))
      .orderBy(desc(xmlEvents.dataEvento), desc(xmlEvents.numeroSequencia));
  }

  async getXmlEventsByXmlId(xmlId: string): Promise<XmlEvent[]> {
    return await db
      .select()
      .from(xmlEvents)
      .where(eq(xmlEvents.xmlId, xmlId))
      .orderBy(desc(xmlEvents.dataEvento), desc(xmlEvents.numeroSequencia));
  }

  async getXmlEvent(id: string): Promise<XmlEvent | undefined> {
    const [event] = await db.select().from(xmlEvents).where(eq(xmlEvents.id, id));
    return event || undefined;
  }

  async getXmlEventsByCompany(companyId: string): Promise<XmlEvent[]> {
    return await db
      .select()
      .from(xmlEvents)
      .where(eq(xmlEvents.companyId, companyId))
      .orderBy(desc(xmlEvents.dataEvento));
  }

  async getXmlEventsByPeriod(
    companyId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<XmlEvent[]> {
    return await db
      .select()
      .from(xmlEvents)
      .where(
        and(
          eq(xmlEvents.companyId, companyId),
          gte(xmlEvents.dataEvento, periodStart),
          lte(xmlEvents.dataEvento, periodEnd)
        )
      )
      .orderBy(desc(xmlEvents.dataEvento));
  }

  async getDuplicateXmlEventForEvento(input: {
    companyId: string;
    chaveNFe: string;
    tipoEvento: string;
    numeroSequencia?: number | null;
    protocolo?: string | null;
    dataEvento?: string | null;
    horaEvento?: string | null;
  }): Promise<XmlEvent | undefined> {
    const baseConditions = [
      eq(xmlEvents.companyId, input.companyId),
      eq(xmlEvents.chaveNFe, input.chaveNFe),
      eq(xmlEvents.tipoEvento, input.tipoEvento),
    ];

    if (typeof input.numeroSequencia === "number") {
      baseConditions.push(eq(xmlEvents.numeroSequencia, input.numeroSequencia));
    }

    if (input.protocolo) {
      baseConditions.push(eq(xmlEvents.protocolo, input.protocolo));
    } else if (input.dataEvento && input.horaEvento) {
      baseConditions.push(eq(xmlEvents.dataEvento, input.dataEvento));
      baseConditions.push(eq(xmlEvents.horaEvento, input.horaEvento));
    }

    const [event] = await db
      .select()
      .from(xmlEvents)
      .where(and(...baseConditions));
    return event || undefined;
  }

  async getDuplicateXmlEventForInutilizacao(input: {
    companyId: string;
    modelo: string;
    serie: string;
    numeroInicial: string;
    numeroFinal: string;
    protocolo?: string | null;
    dataEvento?: string | null;
    horaEvento?: string | null;
  }): Promise<XmlEvent | undefined> {
    const baseConditions = [
      eq(xmlEvents.companyId, input.companyId),
      eq(xmlEvents.tipoEvento, "inutilizacao"),
      eq(xmlEvents.modelo, input.modelo),
      eq(xmlEvents.serie, input.serie),
      eq(xmlEvents.numeroInicial, input.numeroInicial),
      eq(xmlEvents.numeroFinal, input.numeroFinal),
    ];

    if (input.protocolo) {
      baseConditions.push(eq(xmlEvents.protocolo, input.protocolo));
    } else if (input.dataEvento && input.horaEvento) {
      baseConditions.push(eq(xmlEvents.dataEvento, input.dataEvento));
      baseConditions.push(eq(xmlEvents.horaEvento, input.horaEvento));
    }

    const [event] = await db
      .select()
      .from(xmlEvents)
      .where(and(...baseConditions));
    return event || undefined;
  }

  async deleteXmlEvent(id: string): Promise<void> {
    await db.delete(xmlEvents).where(eq(xmlEvents.id, id));
  }

  // Email Check Logs methods
  async createEmailCheckLog(log: InsertEmailCheckLog): Promise<EmailCheckLog> {
    const [created] = await db.insert(emailCheckLogs).values(log).returning();
    return created;
  }

  async updateEmailCheckLog(
    id: string,
    data: Partial<Omit<EmailCheckLog, 'id' | 'createdAt'>>
  ): Promise<EmailCheckLog | undefined> {
    const [updated] = await db
      .update(emailCheckLogs)
      .set(data)
      .where(eq(emailCheckLogs.id, id))
      .returning();
    return updated || undefined;
  }

  async getEmailCheckLogsByMonitor(monitorId: string): Promise<EmailCheckLog[]> {
    return await db
      .select()
      .from(emailCheckLogs)
      .where(eq(emailCheckLogs.emailMonitorId, monitorId))
      .orderBy(desc(emailCheckLogs.startedAt));
  }

  async getAllEmailCheckLogs(filters?: {
    status?: string;
    emailMonitorId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<any[]> {
    let query = db
      .select({
        id: emailCheckLogs.id,
        emailMonitorId: emailCheckLogs.emailMonitorId,
        emailAddress: emailCheckLogs.emailAddress,
        status: emailCheckLogs.status,
        startedAt: emailCheckLogs.startedAt,
        finishedAt: emailCheckLogs.finishedAt,
        durationMs: emailCheckLogs.durationMs,
        emailsChecked: emailCheckLogs.emailsChecked,
        emailsSkippedSeen: emailCheckLogs.emailsSkippedSeen,
        emailsDeleted: emailCheckLogs.emailsDeleted,
        emailsErrored: emailCheckLogs.emailsErrored,
        xmlsFound: emailCheckLogs.xmlsFound,
        xmlsProcessed: emailCheckLogs.xmlsProcessed,
        xmlsDuplicated: emailCheckLogs.xmlsDuplicated,
        lastEmailUid: emailCheckLogs.lastEmailUid,
        lastEmailDate: emailCheckLogs.lastEmailDate,
        lastEmailSubject: emailCheckLogs.lastEmailSubject,
        lastEmailFrom: emailCheckLogs.lastEmailFrom,
        errorMessage: emailCheckLogs.errorMessage,
        errorDetails: emailCheckLogs.errorDetails,
        triggeredBy: emailCheckLogs.triggeredBy,
        createdAt: emailCheckLogs.createdAt,
        companyId: emailMonitors.companyId,
        companyName: companies.razaoSocial,
      })
      .from(emailCheckLogs)
      .leftJoin(emailMonitors, eq(emailCheckLogs.emailMonitorId, emailMonitors.id))
      .leftJoin(companies, eq(emailMonitors.companyId, companies.id));

    const conditions: any[] = [];

    if (filters?.status) {
      conditions.push(eq(emailCheckLogs.status, filters.status));
    }

    if (filters?.emailMonitorId) {
      conditions.push(eq(emailCheckLogs.emailMonitorId, filters.emailMonitorId));
    }

    if (filters?.dateFrom) {
      conditions.push(gte(emailCheckLogs.startedAt, new Date(filters.dateFrom)));
    }

    if (filters?.dateTo) {
      // Add 1 day to include the entire day
      const dateTo = new Date(filters.dateTo);
      dateTo.setDate(dateTo.getDate() + 1);
      conditions.push(lte(emailCheckLogs.startedAt, dateTo));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(emailCheckLogs.startedAt));

    return results;
  }
}


export const storage = new DatabaseStorage();
