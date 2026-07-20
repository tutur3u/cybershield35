import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardScan } from "@/lib/dashboard/cache-invalidation";
import { reviewDraft } from "@/lib/workers/scans";

const bodySchema = z.object({
	status: z.enum(["needs_review", "approved", "rejected"]),
}).strict();
const paramsSchema = z.object({ id: z.uuid() }).strict();

export async function POST(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const { id } = paramsSchema.parse(await context.params);
		const { status } = bodySchema.parse(await request.json());
		const draft = await reviewDraft(id, status, {
			displayName: auth.session.user.displayName ?? null,
			id: auth.session.user.id,
		});
		if (!draft) return Response.json({ error: "Draft not found" }, { status: 404 });
		revalidateDashboardScan(draft.scanJobId);
		const headers = new Headers(authHeaders(auth));
		headers.set("Cache-Control", "no-store");
		return Response.json(
			{ draft, mode: "live" },
			{ headers },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{ error: "Yêu cầu cập nhật trạng thái không hợp lệ.", details: z.treeifyError(error) },
				{ status: 400, headers: authHeaders(auth) },
			);
		}
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Failed to review draft",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
