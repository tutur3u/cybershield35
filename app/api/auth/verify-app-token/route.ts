import { z } from "zod";

import {
	AuthError,
	createPendingInvitationCookie,
	createSessionCookie,
	exchangeTuturuuuAppToken,
	sanitizeAuthError,
	toSafeSession,
} from "@/lib/auth/tuturuuu-session";
import { safePostLoginPath } from "@/lib/auth/routes";
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
		const pendingInvitation =
			safe.code === "PENDING_WORKSPACE_INVITE" &&
			safe.invitation?.workspaceId &&
			error instanceof AuthError &&
			error.details.invitationActionToken
				? createPendingInvitationCookie({
						invitation: safe.invitation,
						invitationActionToken: error.details.invitationActionToken,
						nextPath: safePostLoginPath(
							parsed.data.nextUrl,
							new URL(request.url).origin,
						),
						workspaceId: safe.workspaceId ?? safe.invitation.workspaceId,
					})
				: null;
		const headers = new Headers({ "Cache-Control": "no-store" });
		if (pendingInvitation) {
			headers.append("Set-Cookie", pendingInvitation.cookie);
		}

		return Response.json(
			{
				code: authFailureCode(safe),
				error: safe.message,
				pendingInvitation: pendingInvitation
					? {
							expiresAt: pendingInvitation.pendingInvitation.expiresAt,
							invitation: pendingInvitation.pendingInvitation.invitation,
						}
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
			{ headers, status: safe.status },
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
