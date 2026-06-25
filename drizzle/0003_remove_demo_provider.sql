DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "public"."scan_jobs" WHERE "provider"::text = 'demo') THEN
		RAISE EXCEPTION 'Cannot remove demo provider while scan_jobs rows still use it';
	END IF;

	IF EXISTS (SELECT 1 FROM "public"."provider_runs" WHERE "provider"::text = 'demo') THEN
		RAISE EXCEPTION 'Cannot remove demo provider while provider_runs rows still use it';
	END IF;

	IF EXISTS (SELECT 1 FROM "public"."evidence_items" WHERE "provider"::text = 'demo') THEN
		RAISE EXCEPTION 'Cannot remove demo provider while evidence_items rows still use it';
	END IF;

	IF EXISTS (SELECT 1 FROM "public"."tracked_sources" WHERE "provider"::text = 'demo') THEN
		RAISE EXCEPTION 'Cannot remove demo provider while tracked_sources rows still use it';
	END IF;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."provider_name" RENAME TO "provider_name_old";
--> statement-breakpoint
CREATE TYPE "public"."provider_name" AS ENUM(
	'apify_facebook_posts',
	'apify_facebook_comments',
	'apify_facebook_groups',
	'firecrawl',
	'firecrawl_parse',
	'browser_use',
	'local_text'
);
--> statement-breakpoint
ALTER TABLE "public"."scan_jobs"
	ALTER COLUMN "provider" TYPE "public"."provider_name"
	USING "provider"::text::"public"."provider_name";
--> statement-breakpoint
ALTER TABLE "public"."tracked_sources"
	ALTER COLUMN "provider" TYPE "public"."provider_name"
	USING "provider"::text::"public"."provider_name";
--> statement-breakpoint
ALTER TABLE "public"."provider_runs"
	ALTER COLUMN "provider" TYPE "public"."provider_name"
	USING "provider"::text::"public"."provider_name";
--> statement-breakpoint
ALTER TABLE "public"."evidence_items"
	ALTER COLUMN "provider" TYPE "public"."provider_name"
	USING "provider"::text::"public"."provider_name";
--> statement-breakpoint
DROP TYPE "public"."provider_name_old";
