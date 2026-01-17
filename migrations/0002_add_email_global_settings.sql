CREATE TABLE "email_global_settings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "host" text NOT NULL,
  "port" integer NOT NULL,
  "user" text NOT NULL,
  "password" text NOT NULL,
  "from_email" text NOT NULL,
  "from_name" text NOT NULL,
  "use_ssl" boolean NOT NULL DEFAULT false,
  "use_tls" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
