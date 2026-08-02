import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { listRelatedEvidence } from "@/lib/dashboard/timeline-server";

export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	const parsed = z.uuid().safeParse((await context.params).id);
	if (!parsed.success) {
		return Response.json({ error: "Evidence ID không hợp lệ" }, { status: 400 });
	}

	return Response.json(await listRelatedEvidence(parsed.data), {
		headers: authHeaders(auth),
	});
}
