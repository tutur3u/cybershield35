import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { adminDb } from "@/lib/db/client";
import { evidenceItems, scanJobEvents, scanJobs, sources } from "@/lib/db/schema";
import type { ScanPipelineStage } from "@/lib/operations/telemetry";

/**
 * The stages a scan moves through, in order, with the wording an operator sees.
 *
 * A scan runs on the server for minutes at a time. Without this the only signal
 * is a spinner, so the operator cannot tell a slow provider from a stuck job —
 * and closing the tab looks like it cancelled the work, when in fact nothing was
 * ever tied to the browser.
 */
export const SCAN_PIPELINE_STAGES: Array<{
	id: ScanPipelineStage;
	label: string;
}> = [
	{ id: "queue", label: "Xếp hàng" },
	{ id: "provider", label: "Thu thập nội dung" },
	{ id: "evidence", label: "Lưu bằng chứng" },
	{ id: "analysis", label: "Phân tích" },
	{ id: "topics", label: "Gắn chủ đề" },
	{ id: "complete", label: "Hoàn tất" },
];

export type ScanProgressStage = {
	id: ScanPipelineStage;
	label: string;
	message: string | null;
	occurredAt: string | null;
	status: "completed" | "failed" | "pending" | "running" | "waiting";
};

export type ScanProgressView = {
	completedAt: string | null;
	errorMessage: string | null;
	evidenceCount: number;
	highRiskCount: number;
	percent: number;
	scanId: string;
	stages: ScanProgressStage[];
	startedAt: string | null;
	status: string;
	/** The line to show as "what is happening right now". */
	statusMessage: string | null;
	title: string;
};

const ACTIVE_STATUSES = ["queued", "running", "retrying"] as const;

/**
 * Scans that are still working, whoever started them.
 *
 * Deliberately read from the job table rather than from anything the browser
 * holds: that is what makes progress survive a reload, a navigation, or a
 * different device entirely.
 */
export async function listActiveScanProgress(limit = 6) {
	const rows = await adminDb
		.select({
			id: scanJobs.id,
			fileName: sources.fileName,
			normalizedUrl: sources.normalizedUrl,
			title: sources.title,
		})
		.from(scanJobs)
		.innerJoin(sources, eq(scanJobs.sourceId, sources.id))
		.where(inArray(scanJobs.status, [...ACTIVE_STATUSES]))
		.orderBy(desc(scanJobs.updatedAt))
		.limit(Math.max(1, Math.min(limit, 20)));

	const views = await Promise.all(rows.map((row) => getScanProgress(row.id)));
	return views.filter((view): view is ScanProgressView => Boolean(view));
}

export async function getScanProgress(
	scanId: string,
): Promise<ScanProgressView | null> {
	const [job] = await adminDb
		.select({
			completedAt: scanJobs.completedAt,
			errorMessage: scanJobs.errorMessage,
			fileName: sources.fileName,
			id: scanJobs.id,
			normalizedUrl: sources.normalizedUrl,
			startedAt: scanJobs.startedAt,
			status: scanJobs.status,
			title: sources.title,
		})
		.from(scanJobs)
		.innerJoin(sources, eq(scanJobs.sourceId, sources.id))
		.where(eq(scanJobs.id, scanId))
		.limit(1);
	if (!job) return null;

	const [counts] = await adminDb
		.select({
			evidenceCount: sql<number>`count(*)::int`,
			highRiskCount: sql<number>`count(*) filter (where ${evidenceItems.riskLevel} = 'high')::int`,
		})
		.from(evidenceItems)
		.where(eq(evidenceItems.scanJobId, scanId));

	// Only the newest attempt matters: a retried scan replays the same stages, and
	// showing the previous run's failures beside the current run's progress reads
	// as though both were happening at once.
	const events = await adminDb
		.select({
			message: scanJobEvents.message,
			occurredAt: scanJobEvents.occurredAt,
			stage: scanJobEvents.stage,
			status: scanJobEvents.status,
		})
		.from(scanJobEvents)
		.where(
			and(
				eq(scanJobEvents.scanJobId, scanId),
				// Typed comparison, not a raw template: a bare Date in `sql` leaves
				// Postgres unable to infer the parameter type and the query fails.
				job.startedAt
					? gte(scanJobEvents.occurredAt, job.startedAt)
					: undefined,
			),
		)
		.orderBy(desc(scanJobEvents.occurredAt))
		.limit(60);

	const latestByStage = new Map<string, (typeof events)[number]>();
	for (const event of events) {
		if (!latestByStage.has(event.stage)) latestByStage.set(event.stage, event);
	}

	const stages = SCAN_PIPELINE_STAGES.map(({ id, label }): ScanProgressStage => {
		const event = latestByStage.get(id);
		return {
			id,
			label,
			message: event?.message ?? null,
			occurredAt: event?.occurredAt?.toISOString() ?? null,
			status: normalizeStageStatus(event?.status),
		};
	});

	const latest = events[0] ?? null;
	const finished = job.status === "completed" || job.status === "failed";

	return {
		completedAt: job.completedAt?.toISOString() ?? null,
		errorMessage: job.errorMessage,
		evidenceCount: counts?.evidenceCount ?? 0,
		highRiskCount: counts?.highRiskCount ?? 0,
		percent: progressPercent(stages, job.status),
		scanId: job.id,
		stages,
		startedAt: job.startedAt?.toISOString() ?? null,
		status: job.status,
		statusMessage: finished ? (job.errorMessage ?? latest?.message ?? null) : (latest?.message ?? null),
		title: job.title ?? job.fileName ?? job.normalizedUrl ?? "Nguồn chưa đặt tên",
	};
}

function normalizeStageStatus(value: string | undefined): ScanProgressStage["status"] {
	if (value === "completed" || value === "failed" || value === "running") {
		return value;
	}
	if (value === "waiting") return "waiting";
	return "pending";
}

/**
 * Derived from how far the pipeline actually got, not from the job status alone,
 * so a long provider step still shows movement rather than sitting at one number.
 */
function progressPercent(stages: ScanProgressStage[], status: string) {
	if (status === "completed") return 100;
	const reached = stages.filter((stage) => stage.status !== "pending").length;
	if (!reached) return status === "queued" ? 5 : 10;
	const completed = stages.filter((stage) => stage.status === "completed").length;
	// Half credit for the stage in flight, so the bar advances on entering a step
	// and again on finishing it.
	const weighted = completed + (reached > completed ? 0.5 : 0);
	return Math.min(97, Math.round((weighted / stages.length) * 100));
}
