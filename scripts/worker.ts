import { heartbeat, processNextJob } from "@/lib/workers/scans";
import { logOperation } from "@/lib/operations/telemetry";

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 60_000);

async function tick() {
	const startedAt = Date.now();
	await heartbeat("cybershield35-worker");
	const result = await processNextJob();
	logOperation("worker_tick_completed", {
		durationMs: Date.now() - startedAt,
		processed: result.processed,
		scanId: "scanId" in result ? result.scanId : undefined,
	});
}

async function main() {
	do {
		await tick();
		if (once) break;
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	} while (true);
}

main().catch((error) => {
	logOperation(
		"worker_crashed",
		{ errorType: error instanceof Error ? error.name : "UnknownError" },
		"error",
	);
	process.exit(1);
});
