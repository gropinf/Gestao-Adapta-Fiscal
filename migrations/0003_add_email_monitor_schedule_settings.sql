CREATE TABLE "email_monitor_schedule_settings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
