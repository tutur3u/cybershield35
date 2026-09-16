import { runCloudflareCronRoute } from "@/lib/managed-scheduler/server";

export const maxDuration = 60;

export async function GET(request: Request) {
	return runCloudflareCronRoute(request, "process-article-publications");
}
