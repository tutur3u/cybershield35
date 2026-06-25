import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { scanTrackedSource } from "@/lib/workers/tracked-sources";

export const runtime = "nodejs";

const bodySchema = z.object({}).strict();

export async function POST(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	const body = await request.json().catch(() => ({}));
	const parsedBody = bodySchema.safeParse(body);
	if (!parsedBody.success) {
		return Response.json(
			{ error: z.treeifyError(parsedBody.error) },
			{ status: 400, headers: authHeaders(auth) },
		);
	}

	try {
		const { id } = await context.params;
		const result = await scanTrackedSource(id);
		if (!result) {
			return Response.json({ error: "Tracked source not found" }, { status: 404 });
		}

		return Response.json(
			{
				trackedSource: result.source,
				scan: result.scan,
				mode: "live",
			},
			{ status: 201, headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to scan tracked source",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
