import { proxyManagedSchedulerRequest } from "@/lib/managed-scheduler/server";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ jobKey: string }> },
) {
	const { jobKey } = await params;
	return proxyManagedSchedulerRequest(request, {
		method: "POST",
		path: `jobs/${encodeURIComponent(jobKey)}/run-now`,
	});
}
