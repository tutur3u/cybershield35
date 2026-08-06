import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { publicErrorMessage } from "@/lib/http/public-error";
import { reassessStoredEvidenceRisk } from "@/lib/workers/evidence-risk";

const bodySchema = z
	.object({
		limit: z.number().int().min(1).max(400).default(200),
	})
	.strict();

export const maxDuration = 300;

/**
 * Re-runs the classifier over stored evidence.
 *
 * Sentiment and stance were never judged by anything — providers wrote a
 * default and nothing revised it, so all 1,651 items read "neutral" and
 * "unknown" and the two filters built on them could not match a single row.
 * Re-running is what gives those columns meaning; the same pass re-scores risk,
 * so a rubric change reaches the whole corpus rather than only new scans.
 *
 * Batched to fit the request budget. Rows whose verdict is unchanged are not
 * written, so repeating a run is cheap and converges.
 */
export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const { limit } = bodySchema.parse(body ?? {});
		const result = await reassessStoredEvidenceRisk(limit);
		return Response.json(result, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{ error: "Tham số không hợp lệ." },
				{ headers: authHeaders(auth), status: 400 },
			);
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không phân loại lại được.") },
			{ headers: authHeaders(auth), status: 500 },
		);
	}
}
