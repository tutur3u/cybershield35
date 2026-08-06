import { ZodError } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { getTimelineFacets } from "@/lib/dashboard/timeline-facets";
import { parseTimelineSearchParams } from "@/lib/dashboard/timeline-query";

/**
 * How many results each filter option would return, from where the reader is.
 *
 * Kept off the list response so a slow aggregate never delays the posts
 * themselves — the counts arrive alongside and fill in.
 */
export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	try {
		const parsed = parseTimelineSearchParams(new URL(request.url).searchParams);
		const facets = await getTimelineFacets(parsed.filters);
		return Response.json(facets, { headers: authHeaders(auth) });
	} catch (error) {
		return Response.json(
			{ error: "Không thể đếm bộ lọc." },
			{ headers: authHeaders(auth), status: error instanceof ZodError ? 400 : 503 },
		);
	}
}
