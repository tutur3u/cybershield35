ALTER TABLE "article_media" ADD COLUMN "cms_asset_id" text;--> statement-breakpoint
ALTER TABLE "article_media" ADD COLUMN "cms_entry_id" text;--> statement-breakpoint
ALTER TABLE "article_media" ADD COLUMN "storage_path" text;--> statement-breakpoint
ALTER TABLE "article_media" ADD COLUMN "delivery_url" text;--> statement-breakpoint
ALTER TABLE "article_media" ADD COLUMN "alt_text" text;--> statement-breakpoint
ALTER TABLE "article_media" ADD COLUMN "caption" text;--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" ADD COLUMN "cms_entry_id" text;