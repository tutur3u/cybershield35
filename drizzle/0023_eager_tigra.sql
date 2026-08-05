CREATE TYPE "public"."local_account_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TABLE "local_account_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "local_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"password_hash" text NOT NULL,
	"role" "local_account_role" DEFAULT 'member' NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"password_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text,
	"created_by_display_name" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zalo_oa_connections" ALTER COLUMN "auto_sync_drafts" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "local_account_sessions" ADD CONSTRAINT "local_account_sessions_account_id_local_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."local_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "local_account_sessions_token_idx" ON "local_account_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "local_account_sessions_account_idx" ON "local_account_sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "local_account_sessions_expiry_idx" ON "local_account_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "local_accounts_username_idx" ON "local_accounts" USING btree ("username");--> statement-breakpoint
CREATE INDEX "local_accounts_created_idx" ON "local_accounts" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "public"."local_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."local_accounts" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."local_accounts" IS 'RLS enabled. Password hashes are read and written only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."local_account_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."local_account_sessions" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."local_account_sessions" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';