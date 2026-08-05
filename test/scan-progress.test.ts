import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Scan progress must come from the server, not from state the browser is holding.
 * A scan runs for minutes on the cloud and is not tied to the page that started
 * it, so anything client-held would look like the work was lost on navigation.
 */
describe("scan progress is server-derived and resumable", () => {
	const server = readFileSync("lib/dashboard/scan-progress.ts", "utf8");
	const route = readFileSync("app/api/scans/active/route.ts", "utf8");
	const dock = readFileSync(
		"components/dashboard/scan-progress-dock.tsx",
		"utf8",
	);
	const shell = readFileSync(
		"components/dashboard/dashboard-layout-shell.tsx",
		"utf8",
	);

	test("active scans are found from the job table, not from the caller", () => {
		expect(server).toContain("listActiveScanProgress");
		expect(server).toContain('const ACTIVE_STATUSES = ["queued", "running", "retrying"]');
		expect(route).toContain("listActiveScanProgress");
		// No scan id from the client: whoever started the run, it is reported.
		expect(route).not.toContain("params");
	});

	test("the dock reattaches on mount rather than tracking local runs", () => {
		expect(dock).toContain('queryKey: ["scan-progress", "active"]');
		expect(dock).toContain("refetchInterval");
		expect(dock).toContain("refetchOnWindowFocus: true");
	});

	test("the dock is mounted outside the scrolling page content", () => {
		// Otherwise it would unmount on navigation, which is exactly the loss of
		// context this exists to prevent.
		expect(shell).toContain("<ScanProgressDock />");
	});

	test("every pipeline stage is narrated", () => {
		for (const stage of [
			"queue",
			"provider",
			"evidence",
			"analysis",
			"topics",
			"complete",
		]) {
			expect(server).toContain(`id: "${stage}"`);
		}
	});

	test("the event window uses a typed comparison, not a raw sql template", () => {
		// A bare Date interpolated into `sql` leaves Postgres unable to infer the
		// parameter type, and the whole endpoint 503s.
		expect(server).toContain("gte(scanJobEvents.occurredAt, job.startedAt)");
		expect(server).not.toContain("sql`${scanJobEvents.occurredAt} >=");
	});

	test("progress reflects how far the pipeline got, not just the status", () => {
		// A long provider step should still advance the bar, and a completed scan
		// must read 100 rather than the capped in-flight maximum.
		expect(server).toContain('if (status === "completed") return 100;');
		expect(server).toContain("Math.min(97,");
	});
});

describe("the progress dock has a QueryClient", () => {
	const shell = readFileSync(
		"components/dashboard/dashboard-layout-shell.tsx",
		"utf8",
	);

	test("the dock is wrapped in its own QueryProvider", () => {
		// The dashboard shell renders *above* the per-page QueryProvider, so a
		// useQuery inside it throws "No QueryClient set" during render — which took
		// every authenticated page down. getQueryClient() is a browser singleton,
		// so this shares one cache rather than creating a second.
		expect(shell).toMatch(
			/<QueryProvider>\s*<ScanProgressDock \/>\s*<\/QueryProvider>/u,
		);
	});
});
