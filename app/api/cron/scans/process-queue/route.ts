import {
	json,
	verifyManagedSchedulerRequest,
} from "@/lib/managed-scheduler/server";
import { heartbeat, processNextJob } from "@/lib/workers/scans";

const BATCH_LIMIT = 3;

export async function POST(request: Request) {
	if (!(await verifyManagedSchedulerRequest(request))) {
		return json({ error: "Forbidden" }, { status: 403 });
	}

	await heartbeat("managed-scheduler:process-queue");

	const scanIds: string[] = [];
	let failed = 0;
	let processed = 0;

	for (let index = 0; index < BATCH_LIMIT; index += 1) {
		const result = await processNextJob();
		if (!result.processed) break;

		processed += 1;
		if ("scanId" in result && result.scanId) scanIds.push(result.scanId);
		if ("error" in result && result.error) failed += 1;
	}

	return json({
		failed,
		processed,
		scanIds,
	});
}
