import {
	inviteWorkspaceMembersSchema,
	json,
	proxyWorkspaceMembersRequest,
} from "@/lib/workspace-members/proxy";

export const runtime = "nodejs";

export async function POST(request: Request) {
	const parsed = inviteWorkspaceMembersSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: "Invalid invitation payload" }, { status: 400 });
	}

	return proxyWorkspaceMembersRequest(request, {
		body: {
			emails: [
				...new Set(
					parsed.data.emails.map((email) => email.trim().toLowerCase()),
				),
			],
		},
		method: "POST",
		path: "invitations",
	});
}
