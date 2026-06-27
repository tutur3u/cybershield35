import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardScan } from "@/lib/dashboard/cache-invalidation";
import { reviewDraft } from "@/lib/workers/scans";

const bodySchema = z.object({
	status: z.enum(["draft", "needs_review", "approved", "rejected"]),
});

export async function POST(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	const { id } = await context.params;
	const { status } = bodySchema.parse(await request.json());

	try {
		const draft = await reviewDraft(id, status);
		if (!draft) return Response.json({ error: "Draft not found" }, { status: 404 });
		revalidateDashboardScan(draft.scanJobId);
		return Response.json({ draft, mode: "live" }, { headers: authHeaders(auth) });
	} catch (error) {
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Failed to review draft",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
