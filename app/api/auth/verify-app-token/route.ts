import { z } from "zod";

import { sanitizeTuturuuuWebHref } from "@/lib/auth/login-link";
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
				code: authFailureCode(safe),
				error: safe.message,
				invitationUrl:
					safe.code === "PENDING_WORKSPACE_INVITE"
						? sanitizeTuturuuuWebHref(safe.invitationUrl)
						: undefined,
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

function authFailureCode(error: ReturnType<typeof sanitizeAuthError>) {
	if (error.code === "PENDING_WORKSPACE_INVITE") return error.code;
	if (
		error.status === 403 &&
		!isTuturuuuScopeNotAllowedError({
			error: error.message,
			status: error.status,
		})
	) {
		return "NO_WORKSPACE_ACCESS";
	}
	return error.code;
}
