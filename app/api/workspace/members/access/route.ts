import {
	json,
	proxyWorkspaceMembersRequest,
	removeWorkspaceAccessSchema,
} from "@/lib/workspace-members/proxy";

export async function DELETE(request: Request) {
	const parsed = removeWorkspaceAccessSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: "Invalid access removal payload" }, { status: 400 });
	}

	return proxyWorkspaceMembersRequest(request, {
		body: parsed.data.email
			? { email: parsed.data.email.trim().toLowerCase() }
			: { userId: parsed.data.userId },
		method: "DELETE",
		path: "access",
	});
}
