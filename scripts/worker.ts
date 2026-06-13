import { heartbeat, processNextJob } from "@/lib/workers/scans";

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 60_000);

async function tick() {
	await heartbeat("cybershield35-worker");
	const result = await processNextJob();
	console.log(
		JSON.stringify({
			ts: new Date().toISOString(),
			...result,
		}),
	);
}

async function main() {
	do {
		await tick();
		if (once) break;
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	} while (true);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
