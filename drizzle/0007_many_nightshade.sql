CREATE INDEX "evidence_items_risk_created_idx" ON "evidence_items" USING btree ("risk_level","created_at");--> statement-breakpoint
CREATE INDEX "evidence_items_provider_created_idx" ON "evidence_items" USING btree ("provider","created_at");--> statement-breakpoint
CREATE INDEX "evidence_topics_topic_confidence_idx" ON "evidence_topics" USING btree ("topic_id","confidence","created_at");--> statement-breakpoint
CREATE INDEX "scan_jobs_status_created_idx" ON "scan_jobs" USING btree ("status","created_at");