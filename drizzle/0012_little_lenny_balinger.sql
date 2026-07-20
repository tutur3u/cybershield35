CREATE TYPE "public"."draft_automation_status" AS ENUM('queued', 'running', 'completed', 'failed', 'retrying', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."facebook_page_classification" AS ENUM('uncategorized', 'trusted', 'at_risk');--> statement-breakpoint
CREATE TABLE "draft_automation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_item_id" uuid NOT NULL,
	"page_key" text NOT NULL,
	"classification" "facebook_page_classification" NOT NULL,
	"draft_kind" "draft_kind" NOT NULL,
	"status" "draft_automation_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"draft_id" uuid,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "facebook_page_profiles" (
	"page_key" text PRIMARY KEY NOT NULL,
	"facebook_page_id" text,
	"username" text,
	"display_name" text NOT NULL,
	"classification" "facebook_page_classification" DEFAULT 'uncategorized' NOT NULL,
	"auto_draft_enabled" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"updated_by_display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" ADD COLUMN "automation_key" text;--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" ADD COLUMN "generation_reason" text;--> statement-breakpoint
ALTER TABLE "draft_automation_jobs" ADD CONSTRAINT "draft_automation_jobs_evidence_item_id_evidence_items_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_automation_jobs" ADD CONSTRAINT "draft_automation_jobs_page_key_facebook_page_profiles_page_key_fk" FOREIGN KEY ("page_key") REFERENCES "public"."facebook_page_profiles"("page_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_automation_jobs" ADD CONSTRAINT "draft_automation_jobs_draft_id_counter_argument_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."counter_argument_drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "draft_automation_jobs_evidence_classification_unique" ON "draft_automation_jobs" USING btree ("evidence_item_id","classification");--> statement-breakpoint
CREATE INDEX "draft_automation_jobs_queue_idx" ON "draft_automation_jobs" USING btree ("status","scheduled_at","locked_at");--> statement-breakpoint
CREATE INDEX "draft_automation_jobs_page_status_idx" ON "draft_automation_jobs" USING btree ("page_key","status","updated_at");--> statement-breakpoint
CREATE INDEX "draft_automation_jobs_draft_idx" ON "draft_automation_jobs" USING btree ("draft_id");--> statement-breakpoint
CREATE UNIQUE INDEX "facebook_page_profiles_facebook_id_unique" ON "facebook_page_profiles" USING btree ("facebook_page_id") WHERE "facebook_page_profiles"."facebook_page_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "facebook_page_profiles_username_unique" ON "facebook_page_profiles" USING btree ("username") WHERE "facebook_page_profiles"."username" is not null;--> statement-breakpoint
CREATE INDEX "facebook_page_profiles_classification_updated_idx" ON "facebook_page_profiles" USING btree ("classification","updated_at");--> statement-breakpoint
CREATE INDEX "facebook_page_profiles_automation_idx" ON "facebook_page_profiles" USING btree ("auto_draft_enabled","classification");--> statement-breakpoint
CREATE UNIQUE INDEX "counter_argument_drafts_automation_key_unique" ON "counter_argument_drafts" USING btree ("automation_key") WHERE "counter_argument_drafts"."automation_key" is not null;--> statement-breakpoint
ALTER TABLE "draft_automation_jobs" ADD CONSTRAINT "draft_automation_jobs_attempts_check" CHECK ("attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 10);--> statement-breakpoint
ALTER TABLE "facebook_page_profiles" ADD CONSTRAINT "facebook_page_profiles_page_key_check" CHECK ("page_key" ~ '^(id|username):[^/\\]+$');--> statement-breakpoint
ALTER TABLE "public"."draft_automation_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."facebook_page_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."draft_automation_jobs" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."facebook_page_profiles" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "facebook_page_profiles" IS 'RLS enabled. Stores workspace-managed Facebook page trust classification and internal auto-draft policy through authenticated server routes.';--> statement-breakpoint
COMMENT ON TABLE "draft_automation_jobs" IS 'RLS enabled. Observable, retryable queue for internal human-reviewed drafts; it never publishes externally.';
