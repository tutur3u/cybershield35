import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { getIntelligenceOverview } from "@/lib/dashboard/intelligence-server";
import { parseIntelligenceFilters } from "@/app/api/intelligence/_shared";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const { filters } = parseIntelligenceFilters(
			new URL(request.url).searchParams,
		);
		const overview = await getIntelligenceOverview(filters);
		return Response.json(
			{ overview, mode: "live" },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Unable to load intelligence overview.",
			},
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}
