CREATE TABLE "public"."managed_scheduler_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'managed-scheduler' NOT NULL,
	"token_hash" text NOT NULL,
	"token_last_four" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"setup_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "managed_scheduler_integrations_provider_unique" ON "public"."managed_scheduler_integrations" USING btree ("provider");
--> statement-breakpoint
ALTER TABLE "public"."managed_scheduler_integrations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."managed_scheduler_integrations" FROM PUBLIC;
