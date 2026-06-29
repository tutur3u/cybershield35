import {
	json,
	managedSchedulerExecutionsQuerySchema,
	proxyManagedSchedulerRead,
} from "@/lib/managed-scheduler/server";

export async function GET(request: Request) {
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
	if (parsed.data.jobKey) searchParams.set("jobKey", parsed.data.jobKey);

	return proxyManagedSchedulerRead(request, {
		path: `executions?${searchParams.toString()}`,
	});
}
