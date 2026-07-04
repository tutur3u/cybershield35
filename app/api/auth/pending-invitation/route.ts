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
		return jsonWithCookies(
			{
				error: safe.message,
			},
			{
				cookies:
					safe.status === 401 || safe.status === 404 || safe.status === 409
						? [clearPendingInvitationCookie()]
						: undefined,
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
