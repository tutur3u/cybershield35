import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import {
	revalidateDashboardScan,
	revalidateDashboardTrackedSources,
} from "@/lib/dashboard/cache-invalidation";
import { publicErrorMessage } from "@/lib/http/public-error";
import {
	createRescan,
	getScanDetail,
	listScans,
	processScanJobNow,
} from "@/lib/workers/scans";

const bodySchema = z
	.object({ runMode: z.enum(["now", "queue"]).default("now") })
	.strict();
const idSchema = z.string().uuid();

export const maxDuration = 60;

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const parentId = idSchema.parse((await params).id);
		const input = bodySchema.parse(await request.json().catch(() => ({})));
		const result = await createRescan(parentId, actorFromAuth(auth));
		if (!result) {
			return Response.json({ error: "Không tìm thấy scan gốc." }, { status: 404 });
		}
		const processing =
			input.runMode === "now" && !result.deduplicated
				? await processScanJobNow(result.scanId)
				: null;
		const [detail, scans] = await Promise.all([
			getScanDetail(result.scanId),
			listScans(),
		]);
		revalidateDashboardScan(result.scanId);
		revalidateDashboardTrackedSources();
		return Response.json(
			{
				...result,
				detail,
				processing,
				scan: scans.find((scan) => scan.id === result.scanId) ?? null,
			},
			{ status: 201, headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể quét lại.") },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
