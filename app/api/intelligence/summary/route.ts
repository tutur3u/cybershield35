import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { parseIntelligenceFilters } from "@/app/api/intelligence/_shared";
import { getIntelligenceSummary } from "@/lib/dashboard/intelligence-summary";

/**
 * The written read of the window, on its own route.
 *
 * Separate from `/analytics` on purpose: the charts come straight from Postgres
 * in milliseconds, while this may have to wait on a model. Bundling them would
 * hold every chart on the page hostage to the slowest thing on it.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const { filters } = parseIntelligenceFilters(
			new URL(request.url).searchParams,
		);
		// Null is a legitimate answer — no model configured, or an empty window —
		// and the panel renders nothing rather than an error for it.
		const summary = await getIntelligenceSummary(filters);
		return Response.json({ summary }, { headers: authHeaders(auth) });
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Không thể tạo tóm tắt xu hướng.",
			},
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}
