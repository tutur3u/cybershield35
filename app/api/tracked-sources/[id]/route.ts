import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardTrackedSources } from "@/lib/dashboard/cache-invalidation";
import {
	deleteTrackedSource,
	updateTrackedSource,
} from "@/lib/workers/tracked-sources";

const bodySchema = z
	.object({
		displayName: z.string().trim().min(1).max(200).optional(),
		isActive: z.boolean().optional(),
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
		const body = bodySchema.parse(await request.json());
		const source = await updateTrackedSource(id, body);
		if (!source) {
			return Response.json({ error: "Tracked source not found" }, { status: 404 });
		}
		revalidateDashboardTrackedSources();

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
		const source = await deleteTrackedSource(id);
		if (!source) {
			return Response.json({ error: "Tracked source not found" }, { status: 404 });
		}
		revalidateDashboardTrackedSources();

		return Response.json(
			{ deleted: true, mode: "live", trackedSourceId: id },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to delete tracked source",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
