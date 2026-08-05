import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { listActiveScanProgress } from "@/lib/dashboard/scan-progress";

/**
 * Every scan still in flight, regardless of which browser started it.
 *
 * This is what makes progress resumable: the run lives on the server, so a
 * reload or a navigation reattaches to it instead of losing it.
 */
export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const scans = await listActiveScanProgress();
		return Response.json(
			{ scans },
			{
				headers: {
					...Object.fromEntries(new Headers(authHeaders(auth)).entries()),
					"Cache-Control": "private, no-store",
				},
			},
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Không đọc được tiến độ quét.",
			},
			{ headers: authHeaders(auth), status: 503 },
		);
	}
}
