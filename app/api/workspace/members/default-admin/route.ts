import {
	json,
	proxyWorkspaceMembersRequest,
	updateDefaultAdminSchema,
} from "@/lib/workspace-members/proxy";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
	const parsed = updateDefaultAdminSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: "Invalid default admin payload" }, { status: 400 });
	}

	return proxyWorkspaceMembersRequest(request, {
		body: parsed.data,
		method: "PATCH",
		path: "default-admin",
	});
}
