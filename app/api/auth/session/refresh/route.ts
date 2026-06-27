import {
	createSessionCookie,
	readAdminSession,
	refreshAdminSession,
	sanitizeAuthError,
	toSafeSession,
} from "@/lib/auth/tuturuuu-session";

export async function POST(request: Request) {
	try {
		const current = await readAdminSession(request);
		if (!current) return Response.json({ error: "Authentication required" }, { status: 401 });

		const session = await refreshAdminSession(current);
		return Response.json(
			{ session: toSafeSession(session) },
			{
				headers: {
					"Cache-Control": "no-store",
					"Set-Cookie": createSessionCookie(session),
				},
			},
		);
	} catch (error) {
		const safe = sanitizeAuthError(error);
		return Response.json({ error: safe.message }, { status: safe.status });
	}
}
