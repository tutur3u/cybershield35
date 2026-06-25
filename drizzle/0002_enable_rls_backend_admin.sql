ALTER TABLE "public"."sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."sources" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."sources" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."scan_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."scan_jobs" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."scan_jobs" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."tracked_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."tracked_sources" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."tracked_sources" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."provider_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."provider_runs" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."provider_runs" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."evidence_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."evidence_items" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."evidence_items" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."analyses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."analyses" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."analyses" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."counter_argument_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."counter_argument_drafts" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."counter_argument_drafts" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."audit_events" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."audit_events" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."cron_heartbeats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."cron_heartbeats" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."cron_heartbeats" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';
