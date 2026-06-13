import { clearSessionCookie } from "@/lib/auth/tuturuuu-session";

export const runtime = "nodejs";

export async function POST() {
	return Response.json(
		{ ok: true },
		{
			headers: {
				"Cache-Control": "no-store",
				"Set-Cookie": clearSessionCookie(),
			},
		},
	);
}
