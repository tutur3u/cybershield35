import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { listTopicsPage } from "@/lib/workers/topics";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	const searchParams = new URL(request.url).searchParams;
	const cursor = searchParams.get("cursor");
	const limit = Number(searchParams.get("limit") ?? "25");

	try {
		const page = await listTopicsPage({ cursor, limit });
		return Response.json(
			{ ...page, mode: "live" },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Database unavailable",
			},
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}
