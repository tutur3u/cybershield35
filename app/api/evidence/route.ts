import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { createEvidence } from "@/lib/workers/scans";

const evidenceBodySchema = z
	.object({
		author: z.string().trim().max(160).nullable().optional(),
		quote: z.string().trim().min(1).max(4000),
		riskLevel: z.enum(["low", "medium", "high"]).optional(),
		scanJobId: z.string().uuid(),
		sentiment: z.string().trim().min(1).max(80).optional(),
		sourceLabel: z.string().trim().max(240).nullable().optional(),
		sourceUrl: z
			.preprocess((value) => (value === "" ? null : value), z.url().nullable())
			.optional(),
		stance: z.string().trim().min(1).max(80).optional(),
		summary: z.string().trim().min(1).max(4000),
	})
	.strict();

export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const body = evidenceBodySchema.parse(await request.json());
		const evidence = await createEvidence(body);
		if (!evidence) {
			return Response.json({ error: "Scan not found" }, { status: 404 });
		}

		return Response.json(
			{ evidence, mode: "live" },
			{ status: 201, headers: authHeaders(auth) },
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
						: "Failed to create evidence",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
