import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { publicErrorMessage } from "@/lib/http/public-error";
import { removeHiddenZaloDrafts } from "@/lib/workers/zalo-hidden-cleanup";

const bodySchema = z
	.object({
		// Defaults to a dry run, so a mistaken call only ever reports.
		apply: z.boolean().default(false),
	})
	.strict();

export const maxDuration = 300;

/**
 * Takes CS35's hidden drafts back off the Zalo Official Account.
 *
 * Exposed as a route rather than a script because the Zalo credentials only
 * exist in the deployed environment — the cleanup cannot run from anyone's
 * laptop, so it has to be doable from the product itself.
 */
export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const { apply } = bodySchema.parse(body ?? {});
		const result = await removeHiddenZaloDrafts({
			// The dry run only counts, so it can look at the whole backlog; an
			// applying run stays inside the function's time budget.
			dryRun: !apply,
			limit: apply ? 60 : 500,
		});

		return Response.json(
			{ apply, ...result, remaining: result.scanned - result.removed },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{ error: "Tham số không hợp lệ." },
				{ headers: authHeaders(auth), status: 400 },
			);
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không dọn được bản ẩn trên Zalo.") },
			{ headers: authHeaders(auth), status: 500 },
		);
	}
}
