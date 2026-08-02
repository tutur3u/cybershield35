CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "evidence_semantic_profiles" (
	"evidence_item_id" uuid PRIMARY KEY NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" halfvec(768) NOT NULL,
	"model" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence_semantic_profiles" ADD CONSTRAINT "evidence_semantic_profiles_evidence_item_id_evidence_items_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_semantic_profiles_embedding_hnsw_idx" ON "evidence_semantic_profiles" USING hnsw ("embedding" halfvec_cosine_ops);--> statement-breakpoint
CREATE INDEX "evidence_semantic_profiles_updated_idx" ON "evidence_semantic_profiles" USING btree ("updated_at");--> statement-breakpoint
ALTER TABLE "public"."evidence_semantic_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."evidence_semantic_profiles" FROM PUBLIC;
