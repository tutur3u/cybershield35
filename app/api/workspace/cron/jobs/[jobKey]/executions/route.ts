import {
	json,
	managedSchedulerExecutionsQuerySchema,
	proxyManagedSchedulerRead,
} from "@/lib/managed-scheduler/server";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ jobKey: string }> },
) {
	const { jobKey } = await params;
	const url = new URL(request.url);
	const parsed = managedSchedulerExecutionsQuerySchema.safeParse(
		Object.fromEntries(url.searchParams.entries()),
	);
	if (!parsed.success) {
		return json(
			{ error: "Invalid managed scheduler executions query" },
			{ status: 400 },
		);
	}

	const searchParams = new URLSearchParams({
		page: String(parsed.data.page),
		pageSize: String(parsed.data.pageSize),
	});

	return proxyManagedSchedulerRead(request, {
		path: `jobs/${encodeURIComponent(jobKey)}/executions?${searchParams.toString()}`,
	});
}
