import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardScan } from "@/lib/dashboard/cache-invalidation";
import { updateDraftContent } from "@/lib/workers/scans";

const paramsSchema = z.object({ id: z.uuid() }).strict();
const bodySchema = z
	.object({
		body: z.string().trim().min(1).max(20_000),
	})
	.strict();

export async function PATCH(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const { id } = paramsSchema.parse(await context.params);
		const input = bodySchema.parse(await request.json());
		const draft = await updateDraftContent(id, {
			actor: {
				displayName: auth.session.user.displayName ?? null,
				id: auth.session.user.id,
			},
			body: input.body,
			mode: "manual",
		});
		if (!draft) {
			return Response.json(
				{ error: "Không tìm thấy bản nháp." },
				{ status: 404, headers: authHeaders(auth) },
			);
		}

		revalidateDashboardScan(draft.scanJobId);
		const headers = new Headers(authHeaders(auth));
		headers.set("Cache-Control", "no-store");
		return Response.json({ draft, mode: "manual" }, { headers });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{
					error: "Nội dung bản nháp không hợp lệ.",
					details: z.treeifyError(error),
				},
				{ status: 400, headers: authHeaders(auth) },
			);
		}
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Không thể lưu bản nháp.",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
