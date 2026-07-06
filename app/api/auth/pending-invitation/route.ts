import { z } from "zod";

import {
	clearPendingInvitationCookie,
	createSessionCookie,
	decideTuturuuuPendingInvitation,
	pendingInvitationIsExpired,
	readPendingInvitation,
	sanitizeAuthError,
	toSafeSession,
} from "@/lib/auth/tuturuuu-session";
import { buildLocalLoginPath } from "@/lib/auth/routes";

const bodySchema = z
	.object({
		action: z.enum(["accept", "reject"]),
		csrfToken: z.string().min(16),
	})
	.strict();

const TERMINAL_INVITATION_ERROR_CODES = new Set([
	"INVITATION_ACTION_TOKEN_INVALID_OR_EXPIRED",
	"INVITATION_ACTION_TOKEN_ALREADY_USED",
	"PENDING_INVITATION_NOT_FOUND",
]);

const RETRYABLE_INVITATION_ERROR_CODES = new Set([
	"INVITATION_ACTION_REPLAY_STORE_UNAVAILABLE",
]);

export async function POST(request: Request) {
	const body = await request.json().catch(() => null);
	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) {
		return jsonWithCookies(
			{ error: "Invalid invitation decision payload" },
			{ status: 400 },
		);
	}

	const pendingInvitation = await readPendingInvitation(request);
	if (!pendingInvitation || pendingInvitationIsExpired(pendingInvitation)) {
		return jsonWithCookies(
			{
				code: "PENDING_INVITATION_EXPIRED",
				error: "Pending invitation expired",
				redirectTo: buildLocalLoginPath("/", "invitation"),
			},
			{
				cookies: [clearPendingInvitationCookie()],
				status: 410,
			},
		);
	}

	if (pendingInvitation.csrfToken !== parsed.data.csrfToken) {
		return jsonWithCookies(
			{ error: "Invalid invitation decision token" },
			{ status: 403 },
		);
	}

	try {
		const result = await decideTuturuuuPendingInvitation(
			pendingInvitation,
			parsed.data.action,
		);

		if ("status" in result) {
			return jsonWithCookies(
				{
					redirectTo: buildLocalLoginPath(pendingInvitation.nextPath, "no-access"),
					status: result.status,
				},
				{ cookies: [clearPendingInvitationCookie()] },
			);
		}

		return jsonWithCookies(
			{
				redirectTo: pendingInvitation.nextPath,
				session: toSafeSession(result),
				status: "accepted",
			},
			{
				cookies: [
					clearPendingInvitationCookie(),
					createSessionCookie(result),
				],
			},
		);
	} catch (error) {
		const safe = sanitizeAuthError(error);
		const terminal =
			isTerminalInvitationError(safe.code) ||
			(!isRetryableInvitationError(safe.code) &&
				(safe.status === 401 || safe.status === 404 || safe.status === 409));
		const retryable =
			isRetryableInvitationError(safe.code) ||
			(!terminal && safe.status >= 500);
		return jsonWithCookies(
			{
				...(safe.code ? { code: safe.code } : {}),
				error: safe.message,
				...(terminal
					? {
							redirectTo: buildLocalLoginPath(
								pendingInvitation.nextPath,
								"invitation",
							),
						}
					: {}),
				...(retryable ? { retryable: true } : {}),
			},
			{
				cookies: terminal ? [clearPendingInvitationCookie()] : undefined,
				status: safe.status,
			},
		);
	}
}

function jsonWithCookies(
	body: unknown,
	options: { cookies?: string[]; status?: number } = {},
) {
	const headers = new Headers({ "Cache-Control": "no-store" });
	for (const cookie of options.cookies ?? []) {
		headers.append("Set-Cookie", cookie);
	}
	return Response.json(body, { headers, status: options.status });
}

function isTerminalInvitationError(code: string | undefined) {
	return Boolean(code && TERMINAL_INVITATION_ERROR_CODES.has(code));
}

function isRetryableInvitationError(code: string | undefined) {
	return Boolean(code && RETRYABLE_INVITATION_ERROR_CODES.has(code));
}
