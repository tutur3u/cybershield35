import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { adminDb } from "@/lib/db/client";
import { evidenceItems, scanJobs } from "@/lib/db/schema";

const idSchema = z.string().uuid();

/**
 * Uncached scan progress for the "Quét ngay" indicator. The full scan detail is
 * cached for read performance, which is too stale to narrate a run in progress.
 */
export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const id = idSchema.parse((await context.params).id);
		const [job] = await adminDb
			.select({
				completedAt: scanJobs.completedAt,
				errorMessage: scanJobs.errorMessage,
				id: scanJobs.id,
				startedAt: scanJobs.startedAt,
				status: scanJobs.status,
			})
			.from(scanJobs)
			.where(eq(scanJobs.id, id))
			.limit(1);
		if (!job) {
			return Response.json(
				{ error: "Không tìm thấy lượt quét." },
				{ status: 404, headers: authHeaders(auth) },
			);
		}

		const [counts] = await adminDb
			.select({
				evidenceCount: sql<number>`count(*)::int`,
				highRiskCount: sql<number>`count(*) filter (where ${evidenceItems.riskLevel} = 'high')::int`,
			})
			.from(evidenceItems)
			.where(eq(evidenceItems.scanJobId, id));

		return Response.json(
			{
				completedAt: job.completedAt,
				errorMessage: job.errorMessage,
				evidenceCount: counts?.evidenceCount ?? 0,
				highRiskCount: counts?.highRiskCount ?? 0,
				scanId: job.id,
				startedAt: job.startedAt,
				status: job.status,
			},
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{ error: "Mã lượt quét không hợp lệ." },
				{ status: 400, headers: authHeaders(auth) },
			);
		}
		return Response.json(
			{ error: error instanceof Error ? error.message : "Không đọc được trạng thái." },
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}
