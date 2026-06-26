import { z } from "zod";

import {
	createSessionCookie,
	exchangeTuturuuuAppToken,
	sanitizeAuthError,
	toSafeSession,
} from "@/lib/auth/tuturuuu-session";
import {
	buildTuturuuuScopeApprovalUrl,
	isTuturuuuScopeNotAllowedError,
} from "@/lib/auth/scope-approval";

export const runtime = "nodejs";

const bodySchema = z.object({
	nextUrl: z.string().optional(),
	token: z.string().min(1),
});

export async function POST(request: Request) {
	const body = await request.json().catch(() => null);
	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) {
		return Response.json({ error: "Invalid token payload" }, { status: 400 });
	}

	try {
		const { token } = parsed.data;
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
		const safe = sanitizeAuthError(error);
		return Response.json(
			{
				error: safe.message,
				scopeApprovalHref: isTuturuuuScopeNotAllowedError({
					error: safe.message,
					status: safe.status,
				})
					? buildTuturuuuScopeApprovalUrl({
							appBaseUrl: new URL(request.url).origin,
							nextUrl: parsed.data.nextUrl,
						})
					: undefined,
			},
			{ status: safe.status },
		);
	}
}
