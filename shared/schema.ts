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
  role: text("role").notNull().default("viewer"), // admin, editor, viewer
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Companies table - Empresas/Clientes (Emitentes)
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cnpj: varchar("cnpj", { length: 14 }).notNull().unique(),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia"),
  inscricaoEstadual: text("inscricao_estadual"),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Company Users junction table - Relacionamento multi-tenant
export const companyUsers = pgTable("company_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Accountants table - Contabilidades
export const accountants = pgTable("accountants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  emailContador: text("email_contador").notNull(),
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
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  chave: varchar("chave", { length: 44 }).notNull().unique(), // Chave de acesso da NFe
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
  filepath: text("filepath").notNull(), // Caminho do arquivo no storage
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  companyUsers: many(companyUsers),
  actions: many(actions),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  companyUsers: many(companyUsers),
  xmls: many(xmls),
  accountantCompanies: many(accountantCompanies),
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

export const xmlsRelations = relations(xmls, ({ one }) => ({
  company: one(companies, {
    fields: [xmls.companyId],
    references: [companies.id],
  }),
}));

export const actionsRelations = relations(actions, ({ one }) => ({
  user: one(users, {
    fields: [actions.userId],
    references: [users.id],
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
});

export const insertActionSchema = createInsertSchema(actions).omit({
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

export type Action = typeof actions.$inferSelect;
export type InsertAction = z.infer<typeof insertActionSchema>;
