import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { revalidateDashboardScan } from "@/lib/dashboard/cache-invalidation";
import { toClientScanDetail } from "@/lib/dashboard/detail-projection";
import { publicErrorMessage } from "@/lib/http/public-error";
import {
	getScanDetail,
	reviseAnalysisForScan,
} from "@/lib/workers/scans";

const idSchema = z.string().uuid();

export const maxDuration = 300;

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const scanId = idSchema.parse((await params).id);
		const revision = await reviseAnalysisForScan(scanId, actorFromAuth(auth));
		if (!revision) {
			return Response.json(
				{ error: "Không tìm thấy scan." },
				{ status: 404, headers: authHeaders(auth) },
			);
		}
		const detail = await getScanDetail(scanId);
		revalidateDashboardScan(scanId);
		return Response.json(
			{
				detail: toClientScanDetail(detail),
				evidenceCount: revision.evidenceCount,
				proofCount: revision.proofCount,
				revised: true,
			},
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{ error: "Mã scan không hợp lệ." },
				{ status: 400, headers: authHeaders(auth) },
			);
		}
		return Response.json(
			{
				error: publicErrorMessage(
					error,
					"Không thể phân tích và kiểm chứng lại bằng chứng.",
				),
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
