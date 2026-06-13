import { z } from "zod";

import {
	createSessionCookie,
	exchangeTuturuuuAppToken,
	sanitizeAuthError,
	toSafeSession,
} from "@/lib/auth/tuturuuu-session";

export const runtime = "nodejs";

const bodySchema = z.object({
	token: z.string().min(1),
});

export async function POST(request: Request) {
	try {
		const { token } = bodySchema.parse(await request.json());
		const session = await exchangeTuturuuuAppToken({ token });
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
		if (error instanceof z.ZodError) {
			return Response.json({ error: "Invalid token payload" }, { status: 400 });
		}

		const safe = sanitizeAuthError(error);
		return Response.json({ error: safe.message }, { status: safe.status });
	}
}
