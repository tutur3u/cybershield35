import {
	json,
	runLegacyManagedSchedulerRoute,
	runVercelCronRoute,
} from "@/lib/managed-scheduler/server";
import { managedSchedulerCallbackFailureBody } from "@/lib/managed-scheduler/callback";

const JOB_KEY = "daily-scans";

export const maxDuration = 300;

export async function GET(request: Request) {
	return runVercelCronRoute(request, JOB_KEY);
}

export async function POST(request: Request) {
	try {
		return await runLegacyManagedSchedulerRoute(request, JOB_KEY);
	} catch (error) {
		return json(
			managedSchedulerCallbackFailureBody({ error, operation: JOB_KEY }),
			{ status: 500 },
		);
	}
}
