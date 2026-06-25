import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { getScanDetail } from "@/lib/workers/scans";

export const runtime = "nodejs";

export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	const { id } = await context.params;

	try {
		const detail = await getScanDetail(id);
		if (!detail) return Response.json({ error: "Scan not found" }, { status: 404 });
		return Response.json({ detail, mode: "live" }, { headers: authHeaders(auth) });
	} catch (error) {
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Database unavailable",
			},
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}
