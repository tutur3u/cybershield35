import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardIntelligence, revalidateDashboardScan, revalidateDashboardTrackedSources } from "@/lib/dashboard/cache-invalidation";
import {
	ensureFacebookPageTracked,
	enqueueTrackedSourceScan,
	scanTrackedSource,
} from "@/lib/workers/tracked-sources";

const bodySchema = z.object({
	displayName: z.string().trim().min(1).max(200),
	// Queue-only lets the workspace render a real "queued" state before collection
	// starts; the client then drives processing and polls live progress.
	enqueueOnly: z.boolean().optional(),
	facebookPageId: z.string().trim().min(1).max(200).nullable(),
	pageKey: z.string().trim().min(3).max(240).regex(/^(id|username):[^/\\]+$/u),
	sourceUrl: z.string().url().nullable(),
	username: z.string().trim().min(1).max(100).nullable(),
}).strict();

export const maxDuration = 300;

export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

	try {
		const { enqueueOnly, ...page } = bodySchema.parse(await request.json());
		const source = await ensureFacebookPageTracked(page);
		const result = enqueueOnly
			? await enqueueTrackedSourceScan(source.id)
			: await scanTrackedSource(source.id);
		if (!result) return Response.json({ error: "Không tìm thấy nguồn theo dõi." }, { status: 404, headers: authHeaders(auth) });
		revalidateDashboardTrackedSources();
		revalidateDashboardIntelligence("facebook-pages");
		revalidateDashboardScan(result.scan.scanId);
		return Response.json({ mode: "live", ...result }, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: "Fanpage không hợp lệ.", details: z.treeifyError(error) }, { status: 400, headers: authHeaders(auth) });
		}
		return Response.json({ error: error instanceof Error ? error.message : "Không thể quét fanpage ngay." }, { status: 500, headers: authHeaders(auth) });
	}
}
