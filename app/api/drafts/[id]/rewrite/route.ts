import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardScan } from "@/lib/dashboard/cache-invalidation";
import { reviseDraftWithAi } from "@/lib/workers/scans";

const paramsSchema = z.object({ id: z.uuid() }).strict();
const bodySchema = z
	.object({
		instruction: z.string().trim().min(3).max(2_000),
		length: z
			.enum(["keep", "slightly_longer", "substantially_longer", "shorter"])
			.default("keep"),
		tone: z.string().trim().min(1).max(120),
		voice: z.string().trim().min(1).max(120),
	})
	.strict();

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
		const input = bodySchema.parse(await request.json());
		const draft = await reviseDraftWithAi(id, {
			actor: {
				displayName: auth.session.user.displayName ?? null,
				id: auth.session.user.id,
			},
			instruction: input.instruction,
			length: input.length,
			session: auth.session,
			tone: input.tone,
			voice: input.voice,
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
		return Response.json({ draft, mode: "ai" }, { headers });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{
					error: "Yêu cầu chỉnh sửa bằng AI không hợp lệ.",
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
						: "Không thể chỉnh sửa bản nháp bằng AI.",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
