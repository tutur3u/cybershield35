import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { getOperationsOverview } from "@/lib/operations/server";
import { logOperation } from "@/lib/operations/telemetry";

export async function GET(request: Request) {
	const startedAt = Date.now();
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const overview = await getOperationsOverview();
		logOperation("operations_overview_loaded", {
			durationMs: Date.now() - startedAt,
			requestId: request.headers.get("x-vercel-id"),
		});
		return Response.json(overview, { headers: authHeaders(auth) });
	} catch (error) {
		logOperation(
			"operations_overview_failed",
			{
				durationMs: Date.now() - startedAt,
				errorType: error instanceof Error ? error.name : "UnknownError",
				requestId: request.headers.get("x-vercel-id"),
			},
			"error",
		);
		return Response.json(
			{ error: "Không thể tải dữ liệu vận hành." },
			{ headers: authHeaders(auth), status: 503 },
		);
	}
}
