import "server-only";

import { eq } from "drizzle-orm";

import { adminDb, adminSqlClient } from "@/lib/db/client";
import { draftAutomationJobs, evidenceItems } from "@/lib/db/schema";
import { automatedDraftPolicy } from "@/lib/domain/facebook-page-policy";
import { logOperation } from "@/lib/operations/telemetry";
import { generateDraftForScan } from "@/lib/workers/scans";

type ClaimedDraftJob = {
	attempts: number;
	classification: "trusted" | "at_risk" | "uncategorized";
	draft_kind: "response" | "comment" | "counter_argument" | "internal_brief";
	evidence_item_id: string;
	id: string;
	max_attempts: number;
	page_key: string;
};

export async function processNextAutomatedDraftJob() {
	const claimed = await claimNextDraftJob();
	if (!claimed) return { processed: false } as const;

	try {
		const [evidence] = await adminDb
			.select()
			.from(evidenceItems)
			.where(eq(evidenceItems.id, claimed.evidence_item_id))
			.limit(1);
		if (!evidence) throw new Error("Evidence no longer exists.");

		const policy = automatedDraftPolicy({
			classification: claimed.classification,
			riskLevel: evidence.riskLevel,
			sentiment: evidence.sentiment,
			stance: evidence.stance,
		});
		if (!policy) {
			await adminDb
				.update(draftAutomationJobs)
				.set({
					completedAt: new Date(),
					errorMessage: "Evidence no longer matches the trusted-content policy.",
					status: "skipped",
					updatedAt: new Date(),
				})
				.where(eq(draftAutomationJobs.id, claimed.id));
			return { jobId: claimed.id, processed: true, skipped: true } as const;
		}

		const draft = await generateDraftForScan(evidence.scanJobId, {
			actor: { displayName: "Tự động theo phân loại nguồn", id: "system" },
			audience: policy.audience,
			automationKey: claimed.id,
			draftKind: policy.draftKind,
			evidenceId: evidence.id,
			generationReason: policy.generationReason,
			language: "vi",
			length: "medium",
			operatorNotes: policy.operatorNotes,
			tone: policy.tone,
		});

		await adminDb
			.update(draftAutomationJobs)
			.set({
				completedAt: new Date(),
				draftId: draft.id,
				errorMessage: null,
				status: "completed",
				updatedAt: new Date(),
			})
			.where(eq(draftAutomationJobs.id, claimed.id));
		logOperation("automated_draft_completed", {
			draftId: draft.id,
			jobId: claimed.id,
			pageKey: claimed.page_key,
		});
		return { draftId: draft.id, jobId: claimed.id, processed: true } as const;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const status = claimed.attempts < claimed.max_attempts ? "retrying" : "failed";
		await adminDb
			.update(draftAutomationJobs)
			.set({
				completedAt: status === "failed" ? new Date() : null,
				errorMessage: message.slice(0, 2000),
				scheduledAt:
					status === "retrying" ? new Date(Date.now() + 5 * 60_000) : new Date(),
				status,
				updatedAt: new Date(),
			})
			.where(eq(draftAutomationJobs.id, claimed.id));
		logOperation(
			"automated_draft_failed",
			{ errorType: error instanceof Error ? error.name : "UnknownError", jobId: claimed.id },
			status === "failed" ? "error" : "warn",
		);
		return { error: message, jobId: claimed.id, processed: true } as const;
	}
}

async function claimNextDraftJob() {
	const rows = await adminSqlClient<ClaimedDraftJob[]>`
		update draft_automation_jobs
		set
			status = 'running',
			locked_at = now(),
			attempts = attempts + 1,
			updated_at = now()
		where id = (
			select id
			from draft_automation_jobs
			where status in ('queued', 'retrying')
				and scheduled_at <= now()
			order by scheduled_at asc, created_at asc
			for update skip locked
			limit 1
		)
		returning id, evidence_item_id, page_key, classification, draft_kind, attempts, max_attempts
	`;
	return rows[0] ?? null;
}
