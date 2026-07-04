import { parseIntelligenceFilters } from "@/app/api/intelligence/_shared";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { listIntelligenceEvidence } from "@/lib/dashboard/intelligence-server";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const { cursor, filters, limit } = parseIntelligenceFilters(
			new URL(request.url).searchParams,
		);
		const page = await listIntelligenceEvidence({ cursor, filters, limit });
		return Response.json(
			{ ...page, mode: "live" },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error ? error.message : "Không thể tải bằng chứng.",
			},
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}
