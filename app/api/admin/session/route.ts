import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import {
	isTuturuuuAuthConfigured,
	toSafeSession,
} from "@/lib/auth/tuturuuu-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json(
			{
				authenticated: false,
				configured: isTuturuuuAuthConfigured(),
				error: auth.error,
			},
			{ status: auth.status, headers: { "Cache-Control": "no-store" } },
		);
	}

	return Response.json(
		{
			configured: true,
			session: toSafeSession(auth.session),
		},
		{
			headers: {
				"Cache-Control": "no-store",
				...authHeaders(auth),
			},
		},
	);
}
