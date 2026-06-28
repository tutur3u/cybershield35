import { getManagedSchedulerStatus } from "@/lib/managed-scheduler/server";

export async function GET(request: Request) {
	return getManagedSchedulerStatus(request);
}
