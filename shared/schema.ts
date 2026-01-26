import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - Usuários do sistema
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("cliente"), // admin, cliente, contabilidade
  active: boolean("active").default(false).notNull(), // Usuário ativo (ativado por email)
  activationToken: varchar("activation_token"), // Token de ativação (UUID)
  activationExpiresAt: timestamp("activation_expires_at"), // Expiração do token (24h)
  resetToken: varchar("reset_token"), // Token de reset de senha (UUID)
  resetExpiresAt: timestamp("reset_expires_at"), // Expiração do token de reset (1h)
  lastLoginAt: timestamp("last_login_at"), // Último login
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Companies table - Empresas/Clientes (Emitentes)
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cnpj: varchar("cnpj", { length: 14 }).notNull().unique(),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia"),
  inscricaoEstadual: text("inscricao_estadual"),
  crt: varchar("crt", { length: 1 }), // CRT - Código de Regime Tributário (1=Simples Nacional, 2=Simples excesso, 3=Normal, 4=MEI)
  telefone: varchar("telefone", { length: 20 }), // Telefone de contato
  email: text("email"), // Email de contato
  // Status
  ativo: boolean("ativo").default(true).notNull(), // Empresa ativa
  status: integer("status").default(2).notNull(), // 1=aguardando, 2=liberado, 3=suspenso, 4=cancelado
  // Endereço completo
  rua: text("rua"),
  numero: text("numero"),
  bairro: text("bairro"),
  cidade: text("cidade"),
  uf: varchar("uf", { length: 2 }),
  cep: varchar("cep", { length: 8 }),
  // Email configuration
  emailHost: text("email_host"),
  emailPort: integer("email_port"),
  emailSsl: boolean("email_ssl").default(true),
  emailUser: text("email_user"),
  emailPassword: text("email_password"),
  certificadoPath: text("certificado_path"),
  certificadoSenha: text("certificado_senha"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Company Users junction table - Relacionamento multi-tenant
export const companyUsers = pgTable("company_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Accountants table - Contabilidades (Escritórios Contábeis)
export const accountants = pgTable("accountants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cnpj: varchar("cnpj", { length: 14 }), // CNPJ da contabilidade (opcional, sem unique para retrocompatibilidade)
  nome: text("nome").notNull(), // Razão Social / Nome da Contabilidade
  nomeFantasia: text("nome_fantasia"), // Nome Fantasia
  inscricaoEstadual: text("inscricao_estadual"), // IE
  crt: varchar("crt", { length: 1 }), // CRT
  emailContador: text("email_contador").notNull(), // Email principal do contador
  telefone: varchar("telefone", { length: 20 }), // Telefone de contato
  // Endereço completo
  rua: text("rua"),
  numero: text("numero"),
  bairro: text("bairro"),
  cidade: text("cidade"),
  uf: varchar("uf", { length: 2 }),
  cep: varchar("cep", { length: 8 }),
  // Status
  ativo: boolean("ativo").default(true).notNull(), // Contabilidade ativa
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Accountant Companies junction table
export const accountantCompanies = pgTable("accountant_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountantId: varchar("accountant_id").notNull().references(() => accountants.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// XMLs table - Notas Fiscais
export const xmls = pgTable("xmls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "set null" }), // DEPRECATED: Usar cnpjEmitente/cnpjDestinatario para filtros
  chave: varchar("chave", { length: 44 }).notNull().unique(), // Chave de acesso da NFe
  numeroNota: text("numero_nota"), // Número da nota fiscal (nNF)
  tipoDoc: text("tipo_doc").notNull(), // NFe ou NFCe
  dataEmissao: text("data_emissao").notNull(), // YYYY-MM-DD
  hora: text("hora"), // HH:MM:SS
  cnpjEmitente: varchar("cnpj_emitente", { length: 14 }).notNull(),
  cnpjDestinatario: varchar("cnpj_destinatario", { length: 14 }),
  razaoSocialDestinatario: text("razao_social_destinatario"),
  totalNota: decimal("total_nota", { precision: 12, scale: 2 }).notNull(),
  totalImpostos: decimal("total_impostos", { precision: 12, scale: 2 }),
  categoria: text("categoria").notNull(), // emitida ou recebida
  statusValidacao: text("status_validacao").notNull().default("valido"), // valido, invalido, pendente
  dataCancelamento: text("data_cancelamento"), // Data do cancelamento (YYYY-MM-DD) - preenchido ao receber evento de cancelamento
  filepath: text("filepath").notNull(), // Caminho do arquivo no storage
  danfePath: text("danfe_path"), // Caminho do PDF DANFE gerado
  deletedAt: timestamp("deleted_at"), // Soft delete
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// XML Events table - Eventos e Inutilizações de NFe/NFCe
export const xmlEvents = pgTable("xml_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "set null" }), // Empresa relacionada
  chaveNFe: varchar("chave_nfe", { length: 44 }), // Chave da NFe (para eventos) - pode ser null para inutilização
  xmlId: varchar("xml_id").references(() => xmls.id, { onDelete: "cascade" }), // Referência ao XML da nota (pode ser null se nota não existe)
  tipoEvento: text("tipo_evento").notNull(), // cancelamento, carta_correcao, inutilizacao
  codigoEvento: varchar("codigo_evento", { length: 6 }), // 110111 (cancelamento), 110110 (carta correção), etc
  dataEvento: text("data_evento").notNull(), // Data do evento (YYYY-MM-DD)
  horaEvento: text("hora_evento"), // Hora do evento (HH:MM:SS)
  numeroSequencia: integer("numero_sequencia"), // Número de sequência do evento (para múltiplos eventos da mesma nota)
  protocolo: varchar("protocolo", { length: 20 }), // Número do protocolo
  justificativa: text("justificativa"), // Justificativa (cancelamento, inutilização)
  correcao: text("correcao"), // Texto da correção (carta de correção)
  // Dados específicos de inutilização
  ano: varchar("ano", { length: 2 }), // Ano (para inutilização)
  serie: varchar("serie", { length: 3 }), // Série (para inutilização)
  numeroInicial: varchar("numero_inicial", { length: 9 }), // Número inicial (para inutilização)
  numeroFinal: varchar("numero_final", { length: 9 }), // Número final (para inutilização)
  cnpj: varchar("cnpj", { length: 14 }), // CNPJ (para inutilização)
  modelo: varchar("modelo", { length: 2 }), // Modelo (55 ou 65)
  // Armazenamento
  filepath: text("filepath").notNull(), // Caminho do arquivo XML do evento
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Actions table - Audit trail
export const actions = pgTable("actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // login, upload_xml, send_email, etc.
  details: text("details"), // JSON string with additional details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Alerts table - Sistema de alertas de não-conformidade
export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  xmlId: varchar("xml_id").references(() => xmls.id, { onDelete: "cascade" }), // Opcional - pode ser alerta geral
  type: text("type").notNull(), // xml_invalido, pendente_validacao, erro_sefaz, duplicata, etc
  severity: text("severity").notNull().default("medium"), // low, medium, high, critical
  title: text("title").notNull(),
  message: text("message").notNull(),
  resolved: boolean("resolved").default(false).notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email Monitors table - Monitoramento de email (IMAP) para download automático de XMLs
export const emailMonitors = pgTable("email_monitors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "set null" }), // Nullable - Monitor é global
  email: varchar("email", { length: 255 }).notNull().unique(), // Email único - não permite duplicatas
  password: text("password").notNull(), // Encrypted
  host: varchar("host", { length: 255 }).notNull(),
  port: integer("port").notNull(),
  ssl: boolean("ssl").default(true).notNull(),
  active: boolean("active").default(true).notNull(),
  deleteAfterProcess: boolean("delete_after_process").default(false).notNull(),
  monitorSince: timestamp("monitor_since"), // Data inicial para monitoramento (ignora emails anteriores)
  lastCheckedAt: timestamp("last_checked_at"),
  lastEmailId: text("last_email_id"), // ID do último email processado (para evitar duplicatas)
  checkIntervalMinutes: integer("check_interval_minutes").default(15), // Intervalo de verificação em minutos
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Email Monitor Seen UIDs - UIDs já processados/ignorados
export const emailMonitorSeenUids = pgTable("email_monitor_seen_uids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailMonitorId: varchar("email_monitor_id")
    .notNull()
    .references(() => emailMonitors.id, { onDelete: "cascade" }),
  emailUid: text("email_uid").notNull(),
  reason: text("reason").notNull(), // processed_no_delete, no_xml, duplicate_xml
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email monitor schedule settings (global)
export const emailMonitorScheduleSettings = pgTable("email_monitor_schedule_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enabled: boolean("enabled").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Email Global Settings table - Configuração SMTP global do sistema
export const emailGlobalSettings = pgTable("email_global_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  user: text("user").notNull(),
  password: text("password").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  useSsl: boolean("use_ssl").default(false).notNull(),
  useTls: boolean("use_tls").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Access Requests table - Solicitações de acesso ao sistema
export const accessRequests = pgTable("access_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 14 }),
  message: text("message"), // Mensagem opcional do solicitante
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Access Logs table - Histórico de acesso dos usuários
export const userAccessLogs = pgTable("user_access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "set null" }),
  loginAt: timestamp("login_at"),
  logoutAt: timestamp("logout_at"),
  switchedCompanyAt: timestamp("switched_company_at"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// XML Email History table - Histórico de envio de XMLs por email para contabilidade
export const xmlEmailHistory = pgTable("xml_email_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  destinationEmail: text("destination_email").notNull(), // Email de destino
  periodStart: text("period_start").notNull(), // Data inicial (YYYY-MM-DD)
  periodEnd: text("period_end").notNull(), // Data final (YYYY-MM-DD)
  xmlCount: integer("xml_count").notNull().default(0), // Quantidade de XMLs enviados
  zipFilename: text("zip_filename").notNull(), // Nome do arquivo ZIP gerado
  emailSubject: text("email_subject").notNull(), // Assunto do email
  status: text("status").notNull().default("success"), // success, failed
  errorMessage: text("error_message"), // Mensagem de erro (se houver)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email Check Logs table - Histórico de tentativas de leitura de email (IMAP)
export const emailCheckLogs = pgTable("email_check_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailMonitorId: varchar("email_monitor_id").notNull().references(() => emailMonitors.id, { onDelete: "cascade" }),
  emailAddress: varchar("email_address", { length: 255 }).notNull(), // Email verificado
  status: text("status").notNull(), // success, error
  startedAt: timestamp("started_at").notNull(), // Data/hora de início
  finishedAt: timestamp("finished_at"), // Data/hora de término
  durationMs: integer("duration_ms"), // Duração em milissegundos
  emailsChecked: integer("emails_checked").default(0).notNull(), // Quantidade de emails verificados
  xmlsFound: integer("xmls_found").default(0).notNull(), // Quantidade de XMLs encontrados
  xmlsProcessed: integer("xmls_processed").default(0).notNull(), // Quantidade de XMLs processados com sucesso
  xmlsDuplicated: integer("xmls_duplicated").default(0).notNull(), // Quantidade de XMLs duplicados
  errorMessage: text("error_message"), // Mensagem de erro (se houver)
  errorDetails: text("error_details"), // Detalhes dos erros (JSON array)
  triggeredBy: text("triggered_by").default("manual").notNull(), // manual, cron, api
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  companyUsers: many(companyUsers),
  actions: many(actions),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  companyUsers: many(companyUsers),
  xmls: many(xmls),
  accountantCompanies: many(accountantCompanies),
  emailMonitors: many(emailMonitors),
}));

export const companyUsersRelations = relations(companyUsers, ({ one }) => ({
  user: one(users, {
    fields: [companyUsers.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [companyUsers.companyId],
    references: [companies.id],
  }),
}));

export const accountantsRelations = relations(accountants, ({ many }) => ({
  accountantCompanies: many(accountantCompanies),
}));

export const accountantCompaniesRelations = relations(accountantCompanies, ({ one }) => ({
  accountant: one(accountants, {
    fields: [accountantCompanies.accountantId],
    references: [accountants.id],
  }),
  company: one(companies, {
    fields: [accountantCompanies.companyId],
    references: [companies.id],
  }),
}));

export const xmlsRelations = relations(xmls, ({ one, many }) => ({
  company: one(companies, {
    fields: [xmls.companyId],
    references: [companies.id],
  }),
  events: many(xmlEvents),
}));

export const xmlEventsRelations = relations(xmlEvents, ({ one }) => ({
  company: one(companies, {
    fields: [xmlEvents.companyId],
    references: [companies.id],
  }),
  xml: one(xmls, {
    fields: [xmlEvents.xmlId],
    references: [xmls.id],
  }),
}));

export const actionsRelations = relations(actions, ({ one }) => ({
  user: one(users, {
    fields: [actions.userId],
    references: [users.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  company: one(companies, {
    fields: [alerts.companyId],
    references: [companies.id],
  }),
  xml: one(xmls, {
    fields: [alerts.xmlId],
    references: [xmls.id],
  }),
  resolvedByUser: one(users, {
    fields: [alerts.resolvedBy],
    references: [users.id],
  }),
}));

export const emailMonitorsRelations = relations(emailMonitors, ({ one, many }) => ({
  company: one(companies, {
    fields: [emailMonitors.companyId],
    references: [companies.id],
  }),
  checkLogs: many(emailCheckLogs),
}));

export const accessRequestsRelations = relations(accessRequests, ({ one }) => ({
  reviewedByUser: one(users, {
    fields: [accessRequests.reviewedBy],
    references: [users.id],
  }),
}));

export const userAccessLogsRelations = relations(userAccessLogs, ({ one }) => ({
  user: one(users, {
    fields: [userAccessLogs.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [userAccessLogs.companyId],
    references: [companies.id],
  }),
}));

export const xmlEmailHistoryRelations = relations(xmlEmailHistory, ({ one }) => ({
  company: one(companies, {
    fields: [xmlEmailHistory.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [xmlEmailHistory.userId],
    references: [users.id],
  }),
}));

export const emailCheckLogsRelations = relations(emailCheckLogs, ({ one }) => ({
  emailMonitor: one(emailMonitors, {
    fields: [emailCheckLogs.emailMonitorId],
    references: [emailMonitors.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  passwordHash: true,
  name: true,
  role: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertAccountantSchema = createInsertSchema(accountants).omit({
  id: true,
  createdAt: true,
});

export const insertXmlSchema = createInsertSchema(xmls).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
});

export const insertXmlEventSchema = createInsertSchema(xmlEvents).omit({
  id: true,
  createdAt: true,
});

export const insertActionSchema = createInsertSchema(actions).omit({
  id: true,
  createdAt: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true,
});

export const insertEmailMonitorSchema = createInsertSchema(emailMonitors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailMonitorSeenUidSchema = createInsertSchema(emailMonitorSeenUids).omit({
  id: true,
  createdAt: true,
});

export const insertEmailMonitorScheduleSettingsSchema = createInsertSchema(emailMonitorScheduleSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertEmailGlobalSettingsSchema = createInsertSchema(emailGlobalSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAccessRequestSchema = createInsertSchema(accessRequests).omit({
  id: true,
  createdAt: true,
  reviewedBy: true,
  reviewedAt: true,
});

export const insertUserAccessLogSchema = createInsertSchema(userAccessLogs).omit({
  id: true,
  createdAt: true,
});

export const insertXmlEmailHistorySchema = createInsertSchema(xmlEmailHistory).omit({
  id: true,
  createdAt: true,
});

export const insertEmailCheckLogSchema = createInsertSchema(emailCheckLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type CompanyUser = typeof companyUsers.$inferSelect;

export type Accountant = typeof accountants.$inferSelect;
export type InsertAccountant = z.infer<typeof insertAccountantSchema>;

export type AccountantCompany = typeof accountantCompanies.$inferSelect;

export type Xml = typeof xmls.$inferSelect;
export type InsertXml = z.infer<typeof insertXmlSchema>;

export type XmlEvent = typeof xmlEvents.$inferSelect;
export type InsertXmlEvent = z.infer<typeof insertXmlEventSchema>;

export type Action = typeof actions.$inferSelect;
export type InsertAction = z.infer<typeof insertActionSchema>;

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

export type EmailMonitor = typeof emailMonitors.$inferSelect;
export type InsertEmailMonitor = z.infer<typeof insertEmailMonitorSchema>;

export type EmailMonitorSeenUid = typeof emailMonitorSeenUids.$inferSelect;
export type InsertEmailMonitorSeenUid = z.infer<typeof insertEmailMonitorSeenUidSchema>;

export type EmailMonitorScheduleSettings = typeof emailMonitorScheduleSettings.$inferSelect;
export type InsertEmailMonitorScheduleSettings = z.infer<typeof insertEmailMonitorScheduleSettingsSchema>;

export type EmailGlobalSettings = typeof emailGlobalSettings.$inferSelect;
export type InsertEmailGlobalSettings = z.infer<typeof insertEmailGlobalSettingsSchema>;

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = z.infer<typeof insertAccessRequestSchema>;

export type UserAccessLog = typeof userAccessLogs.$inferSelect;
export type InsertUserAccessLog = z.infer<typeof insertUserAccessLogSchema>;

export type XmlEmailHistory = typeof xmlEmailHistory.$inferSelect;
export type InsertXmlEmailHistory = z.infer<typeof insertXmlEmailHistorySchema>;

export type EmailCheckLog = typeof emailCheckLogs.$inferSelect;
export type InsertEmailCheckLog = z.infer<typeof insertEmailCheckLogSchema>;
