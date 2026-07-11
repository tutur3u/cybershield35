CREATE TYPE "public"."evidence_triage_status" AS ENUM('new', 'reviewing', 'action_required', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TABLE "evidence_triage" (
	"evidence_item_id" uuid PRIMARY KEY NOT NULL,
	"status" "evidence_triage_status" DEFAULT 'new' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"assignee_user_id" text,
	"assignee_display_name" text,
	"due_at" timestamp with time zone,
	"updated_by_user_id" text NOT NULL,
	"updated_by_display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_triage_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_item_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"author_display_name" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence_triage" ADD CONSTRAINT "evidence_triage_evidence_item_id_evidence_items_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_triage_notes" ADD CONSTRAINT "evidence_triage_notes_evidence_item_id_evidence_items_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_triage_status_due_idx" ON "evidence_triage" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "evidence_triage_assignee_status_idx" ON "evidence_triage" USING btree ("assignee_user_id","status");--> statement-breakpoint
CREATE INDEX "evidence_triage_pinned_updated_idx" ON "evidence_triage" USING btree ("is_pinned","updated_at");--> statement-breakpoint
CREATE INDEX "evidence_triage_updated_idx" ON "evidence_triage" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "evidence_triage_notes_evidence_created_idx" ON "evidence_triage_notes" USING btree ("evidence_item_id","created_at");--> statement-breakpoint
CREATE INDEX "evidence_items_published_id_idx" ON "evidence_items" USING btree ("published_at","id");--> statement-breakpoint
CREATE INDEX "evidence_items_risk_published_id_idx" ON "evidence_items" USING btree ("risk_level","published_at","id");--> statement-breakpoint
CREATE INDEX "evidence_items_engagement_published_idx" ON "evidence_items" USING btree ((
				case when coalesce("engagement"->>'reactions', '') ~ '^\d+$' then ("engagement"->>'reactions')::int else 0 end +
				case when coalesce("engagement"->>'comments', '') ~ '^\d+$' then ("engagement"->>'comments')::int else 0 end +
				case when coalesce("engagement"->>'shares', '') ~ '^\d+$' then ("engagement"->>'shares')::int else 0 end
			),"published_at","id");
--> statement-breakpoint
ALTER TABLE "public"."evidence_triage" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."evidence_triage" FROM PUBLIC;
--> statement-breakpoint
COMMENT ON TABLE "public"."evidence_triage" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';
--> statement-breakpoint
ALTER TABLE "public"."evidence_triage_notes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."evidence_triage_notes" FROM PUBLIC;
--> statement-breakpoint
COMMENT ON TABLE "public"."evidence_triage_notes" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';
