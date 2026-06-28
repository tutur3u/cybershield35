import { setupManagedScheduler } from "@/lib/managed-scheduler/server";

export async function POST(request: Request) {
	return setupManagedScheduler(request);
}
