CREATE TABLE IF NOT EXISTS "provider_account_costs" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"account_id" text NOT NULL,
	"day" date NOT NULL,
	"amount_usd" numeric(24, 12) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone,
	"synced_workspace_id" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_account_costs_account_day_idx" ON "provider_account_costs" USING btree ("provider","account_id","day");