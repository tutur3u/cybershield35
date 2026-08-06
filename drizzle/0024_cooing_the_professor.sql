CREATE TABLE "intelligence_summaries" (
	"time_range" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"payload" jsonb NOT NULL,
	"model" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "intelligence_summaries_generated_idx" ON "intelligence_summaries" USING btree ("generated_at");--> statement-breakpoint
-- Same posture as every other table here: reachable only through the service
-- role the application connects with.
ALTER TABLE "public"."intelligence_summaries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."intelligence_summaries" FROM PUBLIC;
