import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { publicErrorMessage } from "@/lib/http/public-error";
import { reconcileZaloRemotePresence } from "@/lib/workers/zalo-presence-reconciliation";

const bodySchema = z
	.object({
		// Defaults to a dry run, so a mistaken call only ever reports.
		apply: z.boolean().default(false),
	})
	.strict();

export const maxDuration = 300;

/**
 * Re-checks which CS35 drafts are still on the Zalo OA.
 *
 * The scheduled run covers this every few minutes; this exists so an operator
 * who is looking at a stale "Còn trên Zalo" right now does not have to wait for
 * the next tick to see it corrected.
 */
export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const { apply } = bodySchema.parse(body ?? {});
		const result = await reconcileZaloRemotePresence({
			dryRun: !apply,
			limit: apply ? 60 : 200,
		});
		return Response.json({ apply, ...result }, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{ error: "Tham số không hợp lệ." },
				{ headers: authHeaders(auth), status: 400 },
			);
		}
		return Response.json(
			{
				error: publicErrorMessage(
					error,
					"Không đối chiếu được trạng thái trên Zalo.",
				),
			},
			{ headers: authHeaders(auth), status: 500 },
		);
	}
}
