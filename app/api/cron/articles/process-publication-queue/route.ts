import { runVercelCronRoute } from "@/lib/managed-scheduler/server";

export const maxDuration = 60;

export async function GET(request: Request) {
	return runVercelCronRoute(request, "process-article-publications");
}
