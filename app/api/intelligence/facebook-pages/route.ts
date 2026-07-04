import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { listIntelligenceFacebookPages } from "@/lib/dashboard/intelligence-server";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const pages = await listIntelligenceFacebookPages();
		return Response.json(
			{ mode: "live", pages },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Không thể tải danh sách fanpage.",
			},
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}
