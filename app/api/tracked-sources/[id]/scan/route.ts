import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import {
	revalidateDashboardScan,
	revalidateDashboardTrackedSources,
} from "@/lib/dashboard/cache-invalidation";
import {
	enqueueTrackedSourceScan,
	scanTrackedSource,
} from "@/lib/workers/tracked-sources";

// `enqueueOnly` lets the workspace show a real "queued" state right away and then
// drive the run through /api/scans/[id]/run while polling live progress.
const bodySchema = z.object({ enqueueOnly: z.boolean().optional() }).strict();

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
		const result = parsedBody.data.enqueueOnly
			? await enqueueTrackedSourceScan(id)
			: await scanTrackedSource(id);
		if (!result) {
			return Response.json(
				{ error: "Không tìm thấy nguồn theo dõi." },
				{ status: 404, headers: authHeaders(auth) },
			);
		}
		revalidateDashboardTrackedSources();
		revalidateDashboardScan(result.scan.scanId);

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
