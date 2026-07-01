CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"risk_level" "risk_level" DEFAULT 'medium' NOT NULL,
	"trend" text DEFAULT 'stable' NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_item_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"scan_job_id" uuid NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence_topics" ADD CONSTRAINT "evidence_topics_evidence_item_id_evidence_items_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "evidence_topics" ADD CONSTRAINT "evidence_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "evidence_topics" ADD CONSTRAINT "evidence_topics_scan_job_id_scan_jobs_id_fk" FOREIGN KEY ("scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "topics_slug_unique" ON "topics" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "topics_priority_idx" ON "topics" USING btree ("risk_level","evidence_count");
--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_topics_unique" ON "evidence_topics" USING btree ("evidence_item_id","topic_id");
--> statement-breakpoint
CREATE INDEX "evidence_topics_topic_idx" ON "evidence_topics" USING btree ("topic_id","created_at");
--> statement-breakpoint
CREATE INDEX "evidence_topics_evidence_idx" ON "evidence_topics" USING btree ("evidence_item_id");
--> statement-breakpoint
CREATE INDEX "evidence_topics_scan_idx" ON "evidence_topics" USING btree ("scan_job_id");
--> statement-breakpoint
ALTER TABLE "public"."topics" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."topics" FROM PUBLIC;
--> statement-breakpoint
COMMENT ON TABLE "public"."topics" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';
--> statement-breakpoint
ALTER TABLE "public"."evidence_topics" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."evidence_topics" FROM PUBLIC;
--> statement-breakpoint
COMMENT ON TABLE "public"."evidence_topics" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';
