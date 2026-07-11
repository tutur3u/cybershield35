import "server-only";

import { desc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import type {
	OperationsOverview,
	OperationsPipelineEventView,
	OperationsProviderView,
	OperationsQueueStatus,
	OperationsServiceView,
} from "@/components/dashboard/types";
import { DASHBOARD_OPERATIONS_TAG } from "@/lib/dashboard/cache-tags";
import { adminDb, adminSqlClient } from "@/lib/db/client";
import {
	cronHeartbeats,
	scanJobEvents,
	scanJobs,
	sources,
	type ProviderName,
	type ScanStatus,
} from "@/lib/db/schema";

type CountRow = { count: number; status: ScanStatus };
type ThroughputRow = {
	average_duration_ms: number | null;
	completed: number;
	failed: number;
};
type ProviderRow = {
	average_duration_ms: number | null;
	completed: number;
	failed: number;
	provider: ProviderName;
	running: number;
};

export async function getOperationsOverview(): Promise<OperationsOverview> {
	"use cache";
	cacheLife({ stale: 10, revalidate: 10, expire: 60 });
	cacheTag(DASHBOARD_OPERATIONS_TAG);

	const [
		countRows,
		throughputRows,
		providerRows,
		heartbeatRows,
		recentJobs,
		oldestQueuedRows,
		recentEvents,
	] = await Promise.all([
		adminSqlClient<CountRow[]>`
			select status, count(*)::int as count
			from scan_jobs
			group by status
		`,
		adminSqlClient<ThroughputRow[]>`
			select
				count(*) filter (where status = 'completed')::int as completed,
				count(*) filter (where status = 'failed')::int as failed,
				coalesce(avg(extract(epoch from (completed_at - started_at)) * 1000)
					filter (where status = 'completed' and completed_at is not null and started_at is not null), 0)::float8 as average_duration_ms
			from scan_jobs
			where updated_at >= now() - interval '24 hours'
		`,
		adminSqlClient<ProviderRow[]>`
			select
				provider,
				count(*) filter (where status = 'completed')::int as completed,
				count(*) filter (where status = 'failed')::int as failed,
				count(*) filter (where status = 'running')::int as running,
				coalesce(avg(extract(epoch from (completed_at - started_at)) * 1000)
					filter (where completed_at is not null), 0)::float8 as average_duration_ms
			from provider_runs
			where started_at >= now() - interval '24 hours'
			group by provider
			order by count(*) desc, provider asc
		`,
		adminDb.select().from(cronHeartbeats).orderBy(desc(cronHeartbeats.lastSeenAt)),
		adminDb
			.select({
				attempts: scanJobs.attempts,
				completedAt: scanJobs.completedAt,
				createdAt: scanJobs.createdAt,
				errorMessage: scanJobs.errorMessage,
				id: scanJobs.id,
				maxAttempts: scanJobs.maxAttempts,
				priority: scanJobs.priority,
				provider: scanJobs.provider,
				scheduledAt: scanJobs.scheduledAt,
				sourceLabel: sources.title,
				startedAt: scanJobs.startedAt,
				status: scanJobs.status,
			})
			.from(scanJobs)
			.innerJoin(sources, eq(sources.id, scanJobs.sourceId))
			.orderBy(desc(scanJobs.updatedAt), desc(scanJobs.createdAt))
			.limit(24),
		adminSqlClient<Array<{ scheduled_at: Date }>>`
			select scheduled_at
			from scan_jobs
			where status in ('queued', 'retrying')
			order by scheduled_at asc
			limit 1
		`,
		adminDb
			.select()
			.from(scanJobEvents)
			.orderBy(desc(scanJobEvents.occurredAt))
			.limit(80),
	]);

	const jobIds = recentJobs.map((job) => job.id);
	const jobEvents = jobIds.length
		? await adminDb
				.select()
				.from(scanJobEvents)
				.where(inArray(scanJobEvents.scanJobId, jobIds))
				.orderBy(desc(scanJobEvents.occurredAt))
		: [];
	const eventViews = recentEvents.map(toEventView);
	const latestEventByJob = new Map<string, OperationsPipelineEventView>();
	for (const event of jobEvents) {
		if (!latestEventByJob.has(event.scanJobId)) {
			latestEventByJob.set(event.scanJobId, toEventView(event));
		}
	}
	const queue = emptyQueueStatus();
	for (const row of countRows) queue[row.status] = Number(row.count);
	const throughput = throughputRows[0] ?? {
		average_duration_ms: 0,
		completed: 0,
		failed: 0,
	};
	const throughputTotal = Number(throughput.completed) + Number(throughput.failed);
	const oldestQueuedAt = oldestQueuedRows[0]?.scheduled_at ?? null;
	const now = new Date();

	return {
		generatedAt: now.toISOString(),
		oldestQueuedAgeSeconds: oldestQueuedAt
			? Math.max(0, Math.round((now.getTime() - new Date(oldestQueuedAt).getTime()) / 1000))
			: null,
		oldestQueuedAt: oldestQueuedAt ? new Date(oldestQueuedAt).toISOString() : null,
		pipelineEvents: eventViews,
		providers: providerRows.map(toProviderView),
		queue,
		recentJobs: recentJobs.map((job) => ({
			attempts: job.attempts,
			createdAt: job.createdAt.toISOString(),
			durationMs: durationMs(job.startedAt, job.completedAt),
			errorMessage: job.errorMessage ? classifyOperationalError(job.errorMessage) : null,
			id: job.id,
			latestEvent: latestEventByJob.get(job.id) ?? null,
			maxAttempts: job.maxAttempts,
			priority: job.priority,
			provider: job.provider,
			scheduledAt: job.scheduledAt.toISOString(),
			sourceLabel: job.sourceLabel ?? "Nguồn không tên",
			status: job.status,
		})),
		services: heartbeatRows.map((row) => toServiceView(row, now)),
		throughput24h: {
			averageDurationMs: Math.round(Number(throughput.average_duration_ms ?? 0)),
			completed: Number(throughput.completed),
			failed: Number(throughput.failed),
			successRate:
				throughputTotal > 0
					? Math.round((Number(throughput.completed) / throughputTotal) * 100)
					: 100,
		},
	};
}

function toEventView(
	event: typeof scanJobEvents.$inferSelect,
): OperationsPipelineEventView {
	return {
		eventType: event.eventType,
		id: event.id,
		message: event.message,
		metadata: event.metadata,
		occurredAt: event.occurredAt.toISOString(),
		scanHref: `/scans/${event.scanJobId}`,
		scanJobId: event.scanJobId,
		stage: event.stage,
		status: event.status,
	};
}

function toProviderView(row: ProviderRow): OperationsProviderView {
	const completed = Number(row.completed);
	const failed = Number(row.failed);
	const total = completed + failed;
	return {
		averageDurationMs: Math.round(Number(row.average_duration_ms ?? 0)),
		completed,
		failed,
		provider: row.provider,
		running: Number(row.running),
		successRate: total > 0 ? Math.round((completed / total) * 100) : 100,
	};
}

function toServiceView(
	row: typeof cronHeartbeats.$inferSelect,
	now: Date,
): OperationsServiceView {
	const ageSeconds = Math.max(
		0,
		Math.round((now.getTime() - row.lastSeenAt.getTime()) / 1000),
	);
	const staleAfter = row.serviceName.includes("enqueue-tracked-sources")
		? 30 * 60 * 60
		: row.serviceName.includes("process-queue")
			? 75 * 60
			: 3 * 60;
	return {
		ageSeconds,
		health: ageSeconds <= staleAfter ? "healthy" : "stale",
		label: serviceLabel(row.serviceName),
		lastSeenAt: row.lastSeenAt.toISOString(),
		serviceName: row.serviceName,
	};
}

function emptyQueueStatus(): OperationsQueueStatus {
	return { completed: 0, failed: 0, queued: 0, retrying: 0, running: 0 };
}

function durationMs(startedAt: Date | null, completedAt: Date | null) {
	return startedAt && completedAt
		? Math.max(0, completedAt.getTime() - startedAt.getTime())
		: null;
}

function serviceLabel(serviceName: string) {
	if (serviceName.includes("enqueue-tracked-sources")) return "Cron xếp nguồn";
	if (serviceName.includes("process-queue")) return "Cron xử lý hàng đợi";
	if (serviceName.includes("worker")) return "Worker xử lý scan";
	return serviceName;
}

function classifyOperationalError(message: string) {
	const normalized = message.toLowerCase();
	if (normalized.includes("timeout")) return "Provider hoặc cơ sở dữ liệu đã hết thời gian chờ.";
	if (normalized.includes("unauthorized") || normalized.includes("forbidden")) {
		return "Provider từ chối xác thực.";
	}
	if (normalized.includes("rate limit")) return "Provider đang giới hạn tần suất.";
	return "Pipeline gặp lỗi; mở scan để xem chẩn đoán an toàn.";
}
