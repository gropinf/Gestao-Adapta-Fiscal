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
  accessRequests,
  userAccessLogs,
  xmlEmailHistory,
  emailCheckLogs,
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
  type Action,
  type InsertAction,
  type Alert,
  type InsertAlert,
  type EmailMonitor,
  type InsertEmailMonitor,
  type AccessRequest,
  type InsertAccessRequest,
  type UserAccessLog,
  type InsertUserAccessLog,
  type XmlEmailHistory,
  type InsertXmlEmailHistory,
  type EmailCheckLog,
  type InsertEmailCheckLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, like, or, gte, lte } from "drizzle-orm";

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
  createXml(xml: InsertXml): Promise<Xml>;
  updateXml(id: string, xml: Partial<InsertXml>): Promise<Xml | undefined>;
  deleteXml(id: string): Promise<void>;
  
  // XML Events
  createXmlEvent(event: InsertXmlEvent): Promise<XmlEvent>;
  getXmlEventsByChave(chaveNFe: string): Promise<XmlEvent[]>;
  getXmlEventsByXmlId(xmlId: string): Promise<XmlEvent[]>;
  getXmlEventsByCompany(companyId: string): Promise<XmlEvent[]>;
  getXmlEventsByPeriod(companyId: string, periodStart: string, periodEnd: string): Promise<XmlEvent[]>;
  deleteXmlEvent(id: string): Promise<void>;
  
  // Actions (Audit)
  logAction(action: InsertAction): Promise<Action>;
  getUserActions(userId: string): Promise<Action[]>;
  
  // Alerts
  createAlert(alert: InsertAlert): Promise<Alert>;
  getAlertsByCompany(companyId: string, filters?: { resolved?: boolean; severity?: string; type?: string }): Promise<Alert[]>;
  getAlert(id: string): Promise<Alert | undefined>;
  resolveAlert(id: string, userId: string): Promise<Alert | undefined>;
  deleteAlert(id: string): Promise<void>;
  
  // Email Monitors
  getEmailMonitor(id: string): Promise<EmailMonitor | undefined>;
  getEmailMonitorsByCompany(companyId: string): Promise<EmailMonitor[]>;
  getAllActiveEmailMonitors(): Promise<EmailMonitor[]>;
  createEmailMonitor(monitor: InsertEmailMonitor): Promise<EmailMonitor>;
  updateEmailMonitor(id: string, monitor: Partial<InsertEmailMonitor>): Promise<EmailMonitor | undefined>;
  deleteEmailMonitor(id: string): Promise<void>;
  updateEmailMonitorLastCheck(id: string): Promise<void>;
  
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
  getXmlEmailHistoryByCompany(companyId: string): Promise<any[]>;
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

  async getXmlsByCnpj(cnpj: string, filters?: XmlFilters): Promise<Xml[]> {
    // Busca XMLs onde o CNPJ é emitente OU destinatário
    let whereCondition = or(
      eq(xmls.cnpjEmitente, cnpj),
      eq(xmls.cnpjDestinatario, cnpj)
    );

    let query = db.select().from(xmls).where(whereCondition);

    // Aplicar filtros adicionais
    const conditions = [whereCondition];

    if (filters?.tipoDoc) {
      conditions.push(eq(xmls.tipoDoc, filters.tipoDoc));
    }
    if (filters?.categoria) {
      conditions.push(eq(xmls.categoria, filters.categoria));
    }
    if (filters?.statusValidacao) {
      conditions.push(eq(xmls.statusValidacao, filters.statusValidacao));
    }

    if (conditions.length > 1) {
      query = db.select().from(xmls).where(and(...conditions));
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

  async getAllActiveEmailMonitors(): Promise<EmailMonitor[]> {
    return await db
      .select()
      .from(emailMonitors)
      .where(eq(emailMonitors.active, true))
      .orderBy(desc(emailMonitors.createdAt));
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
        errorMessage: xmlEmailHistory.errorMessage,
        createdAt: xmlEmailHistory.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(xmlEmailHistory)
      .leftJoin(users, eq(xmlEmailHistory.userId, users.id))
      .where(eq(xmlEmailHistory.companyId, companyId))
      .orderBy(desc(xmlEmailHistory.createdAt));
    
    return results;
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
        xmlsFound: emailCheckLogs.xmlsFound,
        xmlsProcessed: emailCheckLogs.xmlsProcessed,
        xmlsDuplicated: emailCheckLogs.xmlsDuplicated,
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
