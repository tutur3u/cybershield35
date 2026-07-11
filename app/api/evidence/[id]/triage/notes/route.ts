import { z, ZodError } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardIntelligence } from "@/lib/dashboard/cache-invalidation";
import { addEvidenceTriageNote, TimelineNotFoundError } from "@/lib/dashboard/timeline-server";

const paramsSchema = z.object({ id: z.uuid() }).strict();
const noteSchema = z.object({ body: z.string().trim().min(1).max(4_000) }).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const { id } = paramsSchema.parse(await context.params);
		const { body } = noteSchema.parse(await request.json());
		const note = await addEvidenceTriageNote(id, body, {
			displayName: auth.session.user.displayName ?? null,
			id: auth.session.user.id,
		});
		revalidateDashboardIntelligence("timeline");
		revalidateDashboardIntelligence("activity");
		return Response.json({ note }, { headers: authHeaders(auth), status: 201 });
	} catch (error) {
		return Response.json(
			{ error: error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Không thể thêm ghi chú." },
			{ headers: authHeaders(auth), status: error instanceof ZodError ? 400 : error instanceof TimelineNotFoundError ? 404 : 503 },
		);
	}
}
