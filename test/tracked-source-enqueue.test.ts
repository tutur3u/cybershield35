import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ScanStatus } from "@/lib/db/schema";

type TrackedSourceRow = {
	id: string;
	displayName: string;
	isActive: boolean;
	lastScanJobId: string | null;
	lastScanStatus: ScanStatus | null;
	lastScannedAt: Date | null;
	metadata: Record<string, unknown>;
	normalizedUrl: string;
	provider: string;
	type: string;
	updatedAt: Date;
};

type ScanJobRow = {
	completedAt: Date | null;
	errorMessage: string | null;
	id: string;
	status: ScanStatus;
	updatedAt: Date;
};

const trackedSourceRows: TrackedSourceRow[] = [];
const scanJobRows: ScanJobRow[] = [];
let createdScanIndex = 0;

const createScan = mock(
	async (input: { input: string; title?: string }) => {
		createdScanIndex += 1;
		const scanId = `new-scan-${createdScanIndex}`;
		scanJobRows.push({
			completedAt: null,
			errorMessage: null,
			id: scanId,
			status: "queued",
			updatedAt: new Date("2026-07-04T00:00:00.000Z"),
		});
		return {
			input,
			scanId,
			status: "queued" as const,
		};
	},
);

mock.module("server-only", () => ({}));

mock.module("@/lib/workers/scans", () => ({
	createScan,
	heartbeat: mock(async () => undefined),
	processNextJob: mock(async () => ({ processed: false })),
}));

mock.module("@/lib/db/client", () => ({
	adminDb: {
		insert: (table: unknown) => ({
			values: (value: Record<string, unknown>) => ({
				onConflictDoUpdate: async () => {
					if (tableName(table) !== "tracked_sources") return;
					const normalizedUrl = String(value.normalizedUrl ?? "");
					const existing = trackedSourceRows.find(
						(row) => row.normalizedUrl === normalizedUrl,
					);
					if (existing) {
						Object.assign(existing, value, { updatedAt: new Date() });
					}
				},
				returning: async () => [],
			}),
		}),
		select: (projection?: Record<string, unknown>) => ({
			from: (table: unknown) => {
				let rows = rowsForTable(table);
				return {
					orderBy: async () => rows.map((row) => projectRow(row, projection)),
					where: (condition: unknown) => {
						rows = rows.filter((row) => matchesCondition(row, condition));
						return {
							limit: async (limit: number) =>
								rows.slice(0, limit).map((row) => projectRow(row, projection)),
						};
					},
				};
			},
		}),
		update: (table: unknown) => ({
			set: (values: Record<string, unknown>) => ({
				where: async (condition: unknown) => {
					const rows = rowsForTable(table).filter((row) =>
						matchesCondition(row, condition),
					);
					for (const row of rows) Object.assign(row, values);
					return rows;
				},
			}),
		}),
	},
}));

beforeEach(() => {
	trackedSourceRows.length = 0;
	scanJobRows.length = 0;
	createdScanIndex = 0;
	createScan.mockClear();
});

describe("tracked source daily enqueue recovery", () => {
	test("requeues a source whose previous active scan is stale", async () => {
		const staleTime = new Date(Date.now() - 13 * 60 * 60 * 1000);
		trackedSourceRows.push(sourceRow({
			lastScanJobId: "old-scan",
			lastScanStatus: "queued",
			lastScannedAt: staleTime,
		}));
		scanJobRows.push({
			completedAt: null,
			errorMessage: null,
			id: "old-scan",
			status: "running",
			updatedAt: staleTime,
		});

		const { enqueueDueTrackedSources } = await import(
			"@/lib/workers/tracked-sources"
		);
		const result = await enqueueDueTrackedSources({
			staleActiveScanMs: 12 * 60 * 60 * 1000,
			windowMs: 60 * 60 * 1000,
		});

		expect(result).toMatchObject({
			enqueued: 1,
			recovered: 1,
			skipped: 0,
		});
		expect(result.recoveredSources).toEqual([
			{
				reason: "stale_active_scan",
				sourceId: "source-1",
				staleScanId: "old-scan",
			},
		]);
		expect(scanJobRows.find((row) => row.id === "old-scan")).toMatchObject({
			errorMessage:
				"Superseded by tracked-source automation after the previous scan stayed active past the recovery window.",
			status: "failed",
		});
		expect(trackedSourceRows[0]).toMatchObject({
			lastScanJobId: "new-scan-1",
			lastScanStatus: "queued",
			lastScannedAt: expect.any(Date),
		});
		expect(createScan).toHaveBeenCalledWith({
			input: "https://facebook.com/page",
			title: "Tracked page",
		});
	});

	test("keeps a recent active scan blocked instead of duplicating it", async () => {
		const recentTime = new Date(Date.now() - 30 * 60 * 1000);
		trackedSourceRows.push(sourceRow({
			lastScanJobId: "recent-scan",
			lastScanStatus: "running",
			lastScannedAt: recentTime,
		}));
		scanJobRows.push({
			completedAt: null,
			errorMessage: null,
			id: "recent-scan",
			status: "running",
			updatedAt: recentTime,
		});

		const { enqueueDueTrackedSources } = await import(
			"@/lib/workers/tracked-sources"
		);
		const result = await enqueueDueTrackedSources({
			staleActiveScanMs: 12 * 60 * 60 * 1000,
			windowMs: 60 * 60 * 1000,
		});

		expect(result).toMatchObject({
			enqueued: 0,
			recovered: 0,
			skipped: 1,
		});
		expect(result.skippedSources).toEqual([
			{ reason: "scan_in_progress", sourceId: "source-1" },
		]);
		expect(createScan).not.toHaveBeenCalled();
	});

	test("syncs a completed previous scan before applying the duplicate guard", async () => {
		const completedAt = new Date(Date.now() - 30 * 60 * 1000);
		trackedSourceRows.push(sourceRow({
			lastScanJobId: "completed-scan",
			lastScanStatus: "queued",
			lastScannedAt: new Date("2026-07-03T00:00:00.000Z"),
		}));
		scanJobRows.push({
			completedAt,
			errorMessage: null,
			id: "completed-scan",
			status: "completed",
			updatedAt: completedAt,
		});

		const { enqueueDueTrackedSources } = await import(
			"@/lib/workers/tracked-sources"
		);
		const result = await enqueueDueTrackedSources({
			staleActiveScanMs: 12 * 60 * 60 * 1000,
			windowMs: 60 * 60 * 1000,
		});

		expect(result).toMatchObject({
			enqueued: 0,
			recovered: 0,
			skipped: 1,
		});
		expect(result.skippedSources).toEqual([
			{ reason: "recently_scanned", sourceId: "source-1" },
		]);
		expect(trackedSourceRows[0]).toMatchObject({
			lastScanStatus: "completed",
			lastScannedAt: completedAt,
		});
		expect(createScan).not.toHaveBeenCalled();
	});
});

function sourceRow(
	overrides: Partial<TrackedSourceRow> = {},
): TrackedSourceRow {
	return {
		displayName: "Tracked page",
		id: "source-1",
		isActive: true,
		lastScanJobId: null,
		lastScanStatus: null,
		lastScannedAt: null,
		metadata: {},
		normalizedUrl: "https://facebook.com/page",
		provider: "apify_facebook_posts",
		type: "facebook_page",
		updatedAt: new Date("2026-07-01T00:00:00.000Z"),
		...overrides,
	};
}

function rowsForTable(table: unknown) {
	const name = tableName(table);
	if (name === "tracked_sources") return trackedSourceRows;
	if (name === "scan_jobs") return scanJobRows;
	return [];
}

function projectRow(row: Record<string, unknown>, projection?: Record<string, unknown>) {
	if (!projection) return row;
	return Object.fromEntries(Object.keys(projection).map((key) => [key, row[key]]));
}

function matchesCondition(row: Record<string, unknown>, condition: unknown) {
	if (!condition || typeof condition !== "object") return true;
	const chunks = (condition as { queryChunks?: unknown[] }).queryChunks;
	if (!Array.isArray(chunks)) return true;
	const column = chunks[1] as { name?: string } | undefined;
	const param = chunks[3] as { value?: unknown } | undefined;
	const key = columnNameToObjectKey(column?.name ?? "");
	return row[key] === param?.value;
}

function columnNameToObjectKey(name: string) {
	if (name === "last_scan_job_id") return "lastScanJobId";
	return name.replace(/_([a-z])/gu, (_, letter: string) => letter.toUpperCase());
}

function tableName(table: unknown) {
	if (!table || typeof table !== "object") return "";
	for (const symbol of Object.getOwnPropertySymbols(table)) {
		if (String(symbol) === "Symbol(drizzle:Name)") {
			return String((table as Record<symbol, unknown>)[symbol]);
		}
	}
	return "";
}
