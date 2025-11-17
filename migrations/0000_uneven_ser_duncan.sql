CREATE TABLE "access_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"cnpj" varchar(14),
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accountant_companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountant_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accountants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cnpj" varchar(14),
	"nome" text NOT NULL,
	"nome_fantasia" text,
	"inscricao_estadual" text,
	"crt" varchar(1),
	"email_contador" text NOT NULL,
	"telefone" varchar(15),
	"rua" text,
	"numero" text,
	"bairro" text,
	"cidade" text,
	"uf" varchar(2),
	"cep" varchar(8),
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"action" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"xml_id" varchar,
	"type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cnpj" varchar(14) NOT NULL,
	"razao_social" text NOT NULL,
	"nome_fantasia" text,
	"inscricao_estadual" text,
	"crt" varchar(1),
	"telefone" varchar(15),
	"email" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"status" integer DEFAULT 2 NOT NULL,
	"rua" text,
	"numero" text,
	"bairro" text,
	"cidade" text,
	"uf" varchar(2),
	"cep" varchar(8),
	"email_host" text,
	"email_port" integer,
	"email_ssl" boolean DEFAULT true,
	"email_user" text,
	"email_password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "company_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_check_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_monitor_id" varchar NOT NULL,
	"email_address" varchar(255) NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp,
	"duration_ms" integer,
	"emails_checked" integer DEFAULT 0 NOT NULL,
	"xmls_found" integer DEFAULT 0 NOT NULL,
	"xmls_processed" integer DEFAULT 0 NOT NULL,
	"xmls_duplicated" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"error_details" text,
	"triggered_by" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_monitors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"host" varchar(255) NOT NULL,
	"port" integer NOT NULL,
	"ssl" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"monitor_since" timestamp,
	"last_checked_at" timestamp,
	"last_email_id" text,
	"check_interval_minutes" integer DEFAULT 15,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_access_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"company_id" varchar,
	"login_at" timestamp,
	"logout_at" timestamp,
	"switched_company_at" timestamp,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'cliente' NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"activation_token" varchar,
	"activation_expires_at" timestamp,
	"reset_token" varchar,
	"reset_expires_at" timestamp,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "xml_email_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"destination_email" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"xml_count" integer DEFAULT 0 NOT NULL,
	"zip_filename" text NOT NULL,
	"email_subject" text NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xml_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar,
	"chave_nfe" varchar(44),
	"xml_id" varchar,
	"tipo_evento" text NOT NULL,
	"codigo_evento" varchar(6),
	"data_evento" text NOT NULL,
	"hora_evento" text,
	"numero_sequencia" integer,
	"protocolo" varchar(20),
	"justificativa" text,
	"correcao" text,
	"ano" varchar(2),
	"serie" varchar(3),
	"numero_inicial" varchar(9),
	"numero_final" varchar(9),
	"cnpj" varchar(14),
	"modelo" varchar(2),
	"filepath" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xmls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar,
	"chave" varchar(44) NOT NULL,
	"numero_nota" text,
	"tipo_doc" text NOT NULL,
	"data_emissao" text NOT NULL,
	"hora" text,
	"cnpj_emitente" varchar(14) NOT NULL,
	"cnpj_destinatario" varchar(14),
	"razao_social_destinatario" text,
	"total_nota" numeric(12, 2) NOT NULL,
	"total_impostos" numeric(12, 2),
	"categoria" text NOT NULL,
	"status_validacao" text DEFAULT 'valido' NOT NULL,
	"data_cancelamento" text,
	"filepath" text NOT NULL,
	"danfe_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "xmls_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accountant_companies" ADD CONSTRAINT "accountant_companies_accountant_id_accountants_id_fk" FOREIGN KEY ("accountant_id") REFERENCES "public"."accountants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accountant_companies" ADD CONSTRAINT "accountant_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_xml_id_xmls_id_fk" FOREIGN KEY ("xml_id") REFERENCES "public"."xmls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_check_logs" ADD CONSTRAINT "email_check_logs_email_monitor_id_email_monitors_id_fk" FOREIGN KEY ("email_monitor_id") REFERENCES "public"."email_monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_monitors" ADD CONSTRAINT "email_monitors_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access_logs" ADD CONSTRAINT "user_access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access_logs" ADD CONSTRAINT "user_access_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xml_email_history" ADD CONSTRAINT "xml_email_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xml_email_history" ADD CONSTRAINT "xml_email_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xml_events" ADD CONSTRAINT "xml_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xml_events" ADD CONSTRAINT "xml_events_xml_id_xmls_id_fk" FOREIGN KEY ("xml_id") REFERENCES "public"."xmls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xmls" ADD CONSTRAINT "xmls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;