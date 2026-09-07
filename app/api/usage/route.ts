import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { getUsageOverview } from "@/lib/costs/usage-server";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth)
		return Response.json({ error: auth.error }, { status: auth.status });
	try {
		return Response.json(await getUsageOverview(auth.session.accessToken), {
			headers: { ...authHeaders(auth), "Cache-Control": "private, no-store" },
		});
	} catch {
		return Response.json(
			{ error: "Không thể tải mức sử dụng. Vui lòng thử lại." },
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}
