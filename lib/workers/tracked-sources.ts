import { desc, eq } from "drizzle-orm";

import { adminDb } from "@/lib/db/client";
import { scanJobs, trackedSources, type ScanStatus } from "@/lib/db/schema";
import {
	classifyTrackedSourceAutomation,
	isActiveTrackedSourceScanStatus,
	TRACKED_SOURCE_DUPLICATE_GUARD_MS,
	TRACKED_SOURCE_STALE_ACTIVE_SCAN_MS,
} from "@/lib/domain/tracked-source-automation";
import {
	toTrackedSourceSeed,
	type TrackedSourceSeed,
} from "@/lib/domain/tracked-sources";
import { createScan, processScanJobNow } from "@/lib/workers/scans";

export async function listTrackedSources() {
	return adminDb
		.select()
		.from(trackedSources)
		.orderBy(desc(trackedSources.isActive), desc(trackedSources.updatedAt));
}

export async function createTrackedSource(input: {
	url: string;
	displayName?: string;
}) {
	const seed = toTrackedSourceSeed(input.url, input.displayName);
	const [source] = await upsertTrackedSource(seed);
	if (!source) throw new Error("Failed to create tracked source");
	return source;
}

export async function ensureFacebookPageTracked(input: {
	displayName: string;
	facebookPageId?: string | null;
	pageKey: string;
	sourceUrl?: string | null;
	username?: string | null;
}) {
	const url =
		input.sourceUrl ??
		(input.username
			? `https://www.facebook.com/${input.username}`
			: input.facebookPageId
				? `https://www.facebook.com/profile.php?id=${encodeURIComponent(input.facebookPageId)}`
				: null);
	if (!url) throw new Error("Fanpage chưa có định danh Facebook để theo dõi.");

	const seed = toTrackedSourceSeed(url, input.displayName);
	const [source] = await upsertTrackedSource({
		...seed,
		metadata: {
			...seed.metadata,
			facebookPageId: input.facebookPageId ?? null,
			facebookPageKey: input.pageKey,
			username: input.username ?? null,
		},
	});
	if (!source) throw new Error("Không thể tạo nguồn theo dõi cho fanpage.");
	return source;
}

export async function setTrackedSourceActive(id: string, isActive: boolean) {
	const [source] = await adminDb
		.update(trackedSources)
		.set({ isActive, updatedAt: new Date() })
		.where(eq(trackedSources.id, id))
		.returning();

	return source ?? null;
}

export async function updateTrackedSource(
	id: string,
	input: { displayName?: string; isActive?: boolean },
) {
	const [source] = await adminDb
		.update(trackedSources)
		.set({
			...(input.displayName !== undefined
				? { displayName: input.displayName }
				: {}),
			...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
			updatedAt: new Date(),
		})
		.where(eq(trackedSources.id, id))
		.returning();

	return source ?? null;
}

export async function deleteTrackedSource(id: string) {
	const [source] = await adminDb
		.delete(trackedSources)
		.where(eq(trackedSources.id, id))
		.returning();

	return source ?? null;
}

/**
 * Places a scan on the queue and returns immediately so the caller can show a real
 * "queued" state before any collection work starts. Processing is a separate step.
 */
export async function enqueueTrackedSourceScan(id: string) {
	const [source] = await adminDb
		.select()
		.from(trackedSources)
		.where(eq(trackedSources.id, id))
		.limit(1);

	if (!source) return null;
	if (!source.isActive) throw new Error("Nguồn này đang tắt theo dõi.");

	const activeScan = source.lastScanJobId
		? await adminDb
				.select({ id: scanJobs.id, status: scanJobs.status })
				.from(scanJobs)
				.where(eq(scanJobs.id, source.lastScanJobId))
				.limit(1)
				.then((rows) => rows[0] ?? null)
		: null;
	const reusable =
		activeScan &&
		(activeScan.status === "queued" ||
			activeScan.status === "retrying" ||
			activeScan.status === "running");
	const scan = reusable
		? { scanId: activeScan.id, status: activeScan.status }
		: await createTrackedSourceScan(source);

	const [updated] = await adminDb
		.update(trackedSources)
		.set({
			lastScanJobId: scan.scanId,
			lastScanStatus: scan.status,
			lastScannedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(trackedSources.id, source.id))
		.returning();

	return {
		deduplicated: Boolean(reusable),
		scan,
		source: updated ?? source,
	};
}

export async function scanTrackedSource(id: string) {
	const enqueued = await enqueueTrackedSourceScan(id);
	if (!enqueued) return null;
	const { scan, source } = enqueued;
	const updated = source;

	const processing = scan.status === "running"
		? { processed: false }
		: await processScanJobNow(scan.scanId);
	const [finalScan] = await adminDb
		.select({ id: scanJobs.id, status: scanJobs.status })
		.from(scanJobs)
		.where(eq(scanJobs.id, scan.scanId))
		.limit(1);
	const finalStatus = finalScan?.status ?? scan.status;
	const [finalSource] = await adminDb
		.update(trackedSources)
		.set({
			lastScanStatus: finalStatus,
			lastScannedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(trackedSources.id, source.id))
		.returning();

	return {
		processing,
		source: finalSource ?? updated ?? source,
		scan: { scanId: scan.scanId, status: finalStatus },
	};
}

async function createTrackedSourceScan(source: typeof trackedSources.$inferSelect) {
	return createScan({
		input: source.normalizedUrl,
		title: source.displayName,
		trigger: "tracked-source-manual",
	});
}

export async function enqueueDueTrackedSources({
	staleActiveScanMs = TRACKED_SOURCE_STALE_ACTIVE_SCAN_MS,
	windowMs = TRACKED_SOURCE_DUPLICATE_GUARD_MS,
}: {
	staleActiveScanMs?: number;
	windowMs?: number;
} = {}) {
	const sources = await adminDb
		.select()
		.from(trackedSources)
		.orderBy(desc(trackedSources.updatedAt));
	const now = new Date();
	const scans: Array<{ scanId: string; sourceId: string }> = [];
	const recovered: Array<{
		reason: string;
		sourceId: string;
		staleScanId: string | null;
	}> = [];
	const skipped: Array<{ reason: string; sourceId: string }> = [];

	for (const source of sources) {
		const normalizedSource = await normalizeTrackedSourceScanState(source, {
			now,
		});

		const decision = classifyTrackedSourceAutomation({
			duplicateGuardMs: windowMs,
			isActive: normalizedSource.isActive,
			lastScannedAt: normalizedSource.lastScannedAt,
			lastScanStatus: normalizedSource.lastScanStatus,
			now,
			staleActiveScanMs,
		});
		if (decision.blocksEnqueue) {
			skipped.push({ reason: decision.reason, sourceId: normalizedSource.id });
			continue;
		}

		if (decision.kind === "stale_active") {
			await markStaleTrackedSourceScanFailed(normalizedSource, now);
			recovered.push({
				reason: decision.reason,
				sourceId: normalizedSource.id,
				staleScanId: normalizedSource.lastScanJobId,
			});
		}

		const scan = await createScan({
			input: normalizedSource.normalizedUrl,
			title: normalizedSource.displayName,
		});

		await adminDb
			.update(trackedSources)
			.set({
				lastScanJobId: scan.scanId,
				lastScanStatus: scan.status,
				lastScannedAt: now,
				updatedAt: now,
			})
			.where(eq(trackedSources.id, normalizedSource.id));

		scans.push({ scanId: scan.scanId, sourceId: normalizedSource.id });
	}

	return {
		enqueued: scans.length,
		recovered: recovered.length,
		recoveredSources: recovered,
		scans,
		skipped: skipped.length,
		skippedSources: skipped,
	};
}

async function normalizeTrackedSourceScanState(
	source: typeof trackedSources.$inferSelect,
	input: { now: Date },
) {
	if (!isActiveTrackedSourceScanStatus(source.lastScanStatus)) return source;
	if (!source.lastScanJobId) return source;

	const [job] = await adminDb
		.select({
			completedAt: scanJobs.completedAt,
			status: scanJobs.status,
			updatedAt: scanJobs.updatedAt,
		})
		.from(scanJobs)
		.where(eq(scanJobs.id, source.lastScanJobId))
		.limit(1);

	if (!job) return source;
	if (isActiveTrackedSourceScanStatus(job.status)) return source;

	const lastScannedAt = job.completedAt ?? job.updatedAt ?? source.lastScannedAt;
	await adminDb
		.update(trackedSources)
		.set({
			lastScanStatus: job.status,
			lastScannedAt,
			updatedAt: input.now,
		})
		.where(eq(trackedSources.id, source.id));

	return {
		...source,
		lastScanStatus: job.status,
		lastScannedAt,
	};
}

async function markStaleTrackedSourceScanFailed(
	source: typeof trackedSources.$inferSelect,
	now: Date,
) {
	if (!source.lastScanJobId) return;

	await adminDb
		.update(scanJobs)
		.set({
			completedAt: now,
			errorMessage:
				"Superseded by tracked-source automation after the previous scan stayed active past the recovery window.",
			status: "failed" satisfies ScanStatus,
			updatedAt: now,
		})
		.where(eq(scanJobs.id, source.lastScanJobId));
}

async function upsertTrackedSource(seed: TrackedSourceSeed) {
	return adminDb
		.insert(trackedSources)
		.values({
			displayName: seed.displayName,
			normalizedUrl: seed.normalizedUrl,
			type: seed.type,
			provider: seed.provider,
			isActive: seed.isActive,
			metadata: seed.metadata,
		})
		.onConflictDoUpdate({
			target: trackedSources.normalizedUrl,
			set: {
				displayName: seed.displayName,
				type: seed.type,
				provider: seed.provider,
				metadata: seed.metadata,
				updatedAt: new Date(),
			},
		})
		.returning();
}
