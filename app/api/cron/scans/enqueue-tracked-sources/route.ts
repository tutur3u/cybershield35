import {
	json,
	verifyManagedSchedulerRequest,
} from "@/lib/managed-scheduler/server";
import { managedSchedulerCallbackFailureBody } from "@/lib/managed-scheduler/callback";
import { enqueueDueTrackedSources } from "@/lib/workers/tracked-sources";
import { heartbeat } from "@/lib/workers/scans";

export async function POST(request: Request) {
	try {
		if (!(await verifyManagedSchedulerRequest(request))) {
			return json({ error: "Forbidden" }, { status: 403 });
		}

		await heartbeat("managed-scheduler:enqueue-tracked-sources");
		const result = await enqueueDueTrackedSources();

		return json({
			enqueued: result.enqueued,
			scanIds: result.scans.map((scan) => scan.scanId),
			skipped: result.skipped,
		});
	} catch (error) {
		return json(
			managedSchedulerCallbackFailureBody({
				error,
				operation: "enqueue-tracked-sources",
			}),
			{ status: 500 },
		);
	}
}
