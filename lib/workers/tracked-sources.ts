import { desc, eq } from "drizzle-orm";

import { adminDb } from "@/lib/db/client";
import { trackedSources } from "@/lib/db/schema";
import {
	defaultTrackedSourceSeeds,
	toTrackedSourceSeed,
	type TrackedSourceSeed,
} from "@/lib/domain/tracked-sources";
import { createScan } from "@/lib/workers/scans";

const ACTIVE_SCAN_STATUSES = new Set(["queued", "running", "retrying"]);
const DEFAULT_TRACKED_SOURCE_SCAN_WINDOW_MS = 60 * 60 * 1000;

export async function ensureDefaultTrackedSources() {
	for (const seed of defaultTrackedSourceSeeds) {
		await insertDefaultTrackedSource(seed);
	}
}

export async function listTrackedSources() {
	await ensureDefaultTrackedSources();

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

export async function scanTrackedSource(id: string) {
	const [source] = await adminDb
		.select()
		.from(trackedSources)
		.where(eq(trackedSources.id, id))
		.limit(1);

	if (!source) return null;
	if (!source.isActive) throw new Error("Tracked source is inactive");

	const scan = await createScan({
		input: source.normalizedUrl,
		title: source.displayName,
	});

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

	return { source: updated ?? source, scan };
}

export async function enqueueDueTrackedSources({
	windowMs = DEFAULT_TRACKED_SOURCE_SCAN_WINDOW_MS,
}: {
	windowMs?: number;
} = {}) {
	await ensureDefaultTrackedSources();

	const sources = await adminDb
		.select()
		.from(trackedSources)
		.orderBy(desc(trackedSources.updatedAt));
	const now = Date.now();
	const scans: Array<{ scanId: string; sourceId: string }> = [];
	const skipped: Array<{ reason: string; sourceId: string }> = [];

	for (const source of sources) {
		if (!source.isActive) {
			skipped.push({ reason: "inactive", sourceId: source.id });
			continue;
		}

		if (
			source.lastScanStatus &&
			ACTIVE_SCAN_STATUSES.has(source.lastScanStatus)
		) {
			skipped.push({ reason: "scan_in_progress", sourceId: source.id });
			continue;
		}

		if (
			source.lastScannedAt &&
			now - source.lastScannedAt.getTime() < windowMs
		) {
			skipped.push({ reason: "recently_scanned", sourceId: source.id });
			continue;
		}

		const scan = await createScan({
			input: source.normalizedUrl,
			title: source.displayName,
		});

		await adminDb
			.update(trackedSources)
			.set({
				lastScanJobId: scan.scanId,
				lastScanStatus: scan.status,
				lastScannedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(trackedSources.id, source.id));

		scans.push({ scanId: scan.scanId, sourceId: source.id });
	}

	return {
		enqueued: scans.length,
		scans,
		skipped: skipped.length,
		skippedSources: skipped,
	};
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

async function insertDefaultTrackedSource(seed: TrackedSourceSeed) {
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
		.onConflictDoNothing({ target: trackedSources.normalizedUrl });
}
