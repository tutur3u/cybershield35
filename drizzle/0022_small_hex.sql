ALTER TABLE "articles" ADD COLUMN "cms_entry_id" text;--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" DROP COLUMN "cms_entry_id";--> statement-breakpoint
ALTER TABLE "zalo_oa_connections" ALTER COLUMN "auto_sync_drafts" SET DEFAULT false;--> statement-breakpoint
UPDATE "zalo_oa_connections" SET "auto_sync_drafts" = false;
