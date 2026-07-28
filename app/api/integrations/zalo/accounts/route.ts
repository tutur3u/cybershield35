import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { publicErrorMessage } from "@/lib/http/public-error";
import { isZaloEnabled } from "@/lib/zalo/client";
import { listSafeZaloConnections } from "@/lib/zalo/connections";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	const configured = Boolean(
		process.env.ZALO_APP_ID &&
			process.env.ZALO_APP_SECRET &&
			process.env.ZALO_TOKEN_ENCRYPTION_KEY,
	);
	const enabled = isZaloEnabled();
	if (!configured || !enabled) {
		return Response.json(
			{ accounts: [], configured, enabled },
			{ headers: authHeaders(auth) },
		);
	}
	try {
		return Response.json(
			{
				accounts: await listSafeZaloConnections(),
				configured,
				enabled,
			},
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error: publicErrorMessage(error, "Không thể đọc kết nối Zalo OA."),
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
