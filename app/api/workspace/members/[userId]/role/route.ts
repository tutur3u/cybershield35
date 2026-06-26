import {
	json,
	proxyWorkspaceMembersRequest,
	updateWorkspaceMemberRoleSchema,
} from "@/lib/workspace-members/proxy";

export const runtime = "nodejs";

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ userId: string }> },
) {
	const { userId } = await params;
	const parsed = updateWorkspaceMemberRoleSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: "Invalid role payload" }, { status: 400 });
	}

	return proxyWorkspaceMembersRequest(request, {
		body: parsed.data,
		method: "PATCH",
		path: `${encodeURIComponent(userId)}/role`,
	});
}
