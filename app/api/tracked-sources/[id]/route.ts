import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { setTrackedSourceActive } from "@/lib/workers/tracked-sources";

export const runtime = "nodejs";

const bodySchema = z.object({
	isActive: z.boolean(),
});

export async function PATCH(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const { id } = await context.params;
		const body = bodySchema.parse(await request.json());
		const source = await setTrackedSourceActive(id, body.isActive);
		if (!source) {
			return Response.json({ error: "Tracked source not found" }, { status: 404 });
		}

		return Response.json(
			{ trackedSource: source, mode: "live" },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}

		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to update tracked source",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
