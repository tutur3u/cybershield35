import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { parseIntelligenceFilters } from "@/app/api/intelligence/_shared";
import { getIntelligenceAnalytics } from "@/lib/dashboard/intelligence-analytics";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const { filters } = parseIntelligenceFilters(
			new URL(request.url).searchParams,
		);
		const analytics = await getIntelligenceAnalytics(filters);
		return Response.json({ analytics }, { headers: authHeaders(auth) });
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Không thể tải số liệu phân tích.",
			},
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}
