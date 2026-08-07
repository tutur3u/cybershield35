UPDATE "facebook_page_profiles"
SET
	"auto_draft_enabled" = false,
	"updated_at" = now()
WHERE "auto_draft_enabled" = true;
--> statement-breakpoint
ALTER TABLE "facebook_page_profiles"
ALTER COLUMN "auto_draft_enabled" SET DEFAULT false;
--> statement-breakpoint
UPDATE "draft_automation_jobs"
SET
	"status" = 'skipped',
	"locked_at" = NULL,
	"completed_at" = COALESCE("completed_at", now()),
	"error_message" = 'Automatic drafting was retired; create articles explicitly from evidence.',
	"updated_at" = now()
WHERE "status" IN ('queued', 'running', 'retrying');
