import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { deleteScan, getScanDetail, updateScan } from "@/lib/workers/scans";

export const runtime = "nodejs";

const patchSchema = z
	.object({
		status: z
			.enum(["queued", "running", "completed", "failed", "retrying"])
			.optional(),
		title: z.string().trim().min(1).max(240).optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0);

export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	const { id } = await context.params;

	try {
		const detail = await getScanDetail(id);
		if (!detail) return Response.json({ error: "Scan not found" }, { status: 404 });
		return Response.json({ detail, mode: "live" }, { headers: authHeaders(auth) });
	} catch (error) {
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Database unavailable",
			},
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}

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
		const body = patchSchema.parse(await request.json());
		const scan = await updateScan(id, body);
		if (!scan) return Response.json({ error: "Scan not found" }, { status: 404 });

		return Response.json(
			{ mode: "live", scan },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}

		return Response.json(
			{
				error: error instanceof Error ? error.message : "Failed to update scan",
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
		const deleted = await deleteScan(id);
		if (!deleted) {
			return Response.json({ error: "Scan not found" }, { status: 404 });
		}

		return Response.json(
			{ deleted: true, mode: "live" },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Failed to delete scan",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
