import { clearSessionCookie } from "@/lib/auth/tuturuuu-session";

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
