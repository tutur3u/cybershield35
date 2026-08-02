import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardIntelligence } from "@/lib/dashboard/cache-invalidation";
import { rebuildEvidenceSemanticProfiles } from "@/lib/workers/evidence-semantics";

export const maxDuration = 300;

const requestSchema = z.object({ force: z.boolean().default(false) }).strict();

export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const input = requestSchema.parse(await request.json());
		const result = await rebuildEvidenceSemanticProfiles(auth.session, input);
		if (result.generated > 0) revalidateDashboardIntelligence("evidence");
		return Response.json(result, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Không thể tạo lại semantic embedding.",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
