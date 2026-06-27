import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardScan } from "@/lib/dashboard/cache-invalidation";
import { deleteEvidence, updateEvidence } from "@/lib/workers/scans";

const evidencePatchSchema = z
	.object({
		author: z.string().trim().max(160).nullable().optional(),
		quote: z.string().trim().min(1).max(4000).optional(),
		riskLevel: z.enum(["low", "medium", "high"]).optional(),
		sentiment: z.string().trim().min(1).max(80).optional(),
		sourceLabel: z.string().trim().max(240).nullable().optional(),
		sourceUrl: z
			.preprocess((value) => (value === "" ? null : value), z.url().nullable())
			.optional(),
		stance: z.string().trim().min(1).max(80).optional(),
		summary: z.string().trim().min(1).max(4000).optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0);

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
		const body = evidencePatchSchema.parse(await request.json());
		const evidence = await updateEvidence(id, body);
		if (!evidence) {
			return Response.json({ error: "Evidence not found" }, { status: 404 });
		}
		revalidateDashboardScan(evidence.scanJobId);

		return Response.json(
			{ evidence, mode: "live" },
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
						: "Failed to update evidence",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}

export async function DELETE(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const { id } = await context.params;
		const evidence = await deleteEvidence(id);
		if (!evidence) {
			return Response.json({ error: "Evidence not found" }, { status: 404 });
		}
		revalidateDashboardScan(evidence.scanJobId);

		return Response.json(
			{ deleted: true, evidenceId: id, mode: "live" },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to delete evidence",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
