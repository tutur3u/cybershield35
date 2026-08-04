CREATE TYPE "public"."article_state" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "state" "article_state" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "draft_kind" "draft_kind";--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "generation_reason" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "tone" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "voice" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "audience" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "language" text DEFAULT 'vi' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "operator_notes" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "citations" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "safety_notes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "automation_key" text;--> statement-breakpoint
CREATE INDEX "articles_state_updated_idx" ON "articles" USING btree ("state","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_automation_key_unique" ON "articles" USING btree ("automation_key") WHERE "articles"."automation_key" is not null;