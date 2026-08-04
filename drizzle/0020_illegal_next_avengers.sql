CREATE UNIQUE INDEX "articles_origin_draft_unique" ON "articles" USING btree ("origin_draft_id") WHERE "articles"."origin_draft_id" is not null;--> statement-breakpoint
INSERT INTO "articles" (
	"title", "author", "description", "blocks", "comments_enabled",
	"review_status", "state", "draft_kind", "generation_reason", "tone", "voice",
	"audience", "language", "operator_notes", "citations", "safety_notes",
	"automation_key", "publication_status", "origin_scan_job_id",
	"origin_evidence_item_id", "origin_draft_id", "originating_chat_id",
	"content_hash", "created_by_user_id", "created_by_display_name",
	"updated_by_user_id", "updated_by_display_name", "created_at", "updated_at"
)
SELECT
	left(coalesce(nullif(split_part(d."body", E'\n', 1), ''), 'Bài viết chưa đặt tên'), 150),
	coalesce(d."created_by_display_name", 'CyberShield35'),
	left(d."body", 300),
	jsonb_build_array(jsonb_build_object('id', d."id"::text || '-body', 'type', 'text', 'content', d."body")),
	true, d."status"::text::"article_review_status", 'draft'::"article_state",
	d."draft_kind", d."generation_reason", d."tone", d."voice", d."audience", d."language",
	d."operator_notes", d."citations", d."safety_notes", d."automation_key", 'not_synced',
	d."scan_job_id", d."evidence_item_id", d."id", d."originating_chat_id",
	md5(d."id"::text || d."body" || d."updated_at"::text),
	coalesce(d."created_by_user_id", 'system'), d."created_by_display_name",
	coalesce(d."updated_by_user_id", d."created_by_user_id", 'system'), d."updated_by_display_name",
	d."created_at", d."updated_at"
FROM "counter_argument_drafts" d
WHERE NOT EXISTS (SELECT 1 FROM "articles" a WHERE a."origin_draft_id" = d."id")
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "article_evidence" ("article_id", "evidence_item_id", "created_at")
SELECT a."id", d."evidence_item_id", d."created_at"
FROM "articles" a
JOIN "counter_argument_drafts" d ON d."id" = a."origin_draft_id"
WHERE d."evidence_item_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "article_versions" (
	"article_id", "version", "origin", "instruction", "snapshot",
	"actor_user_id", "actor_display_name", "created_at"
)
SELECT
	a."id", v."version", 'legacy_draft', 'Migrated from legacy draft',
	jsonb_build_object(
		'title', a."title", 'author', a."author", 'description', a."description",
		'coverUrl', a."cover_url", 'commentsEnabled', a."comments_enabled",
		'targetOaConnectionId', a."target_oa_connection_id",
		'blocks', jsonb_build_array(jsonb_build_object('id', v."id"::text || '-body', 'type', 'text', 'content', v."body"))
	),
	v."actor_user_id", v."actor_display_name", v."created_at"
FROM "counter_argument_draft_versions" v
JOIN "articles" a ON a."origin_draft_id" = v."draft_id"
ON CONFLICT DO NOTHING;
