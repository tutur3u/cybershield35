import {
	json,
	managedSchedulerJobPatchSchema,
	proxyManagedSchedulerRequest,
} from "@/lib/managed-scheduler/server";

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ jobKey: string }> },
) {
	const { jobKey } = await params;
	const parsed = managedSchedulerJobPatchSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: "Invalid managed scheduler job payload" }, { status: 400 });
	}

	return proxyManagedSchedulerRequest(request, {
		body: parsed.data,
		method: "PATCH",
		path: `jobs/${encodeURIComponent(jobKey)}`,
	});
}
