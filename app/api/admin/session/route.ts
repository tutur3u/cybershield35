import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { sanitizeTuturuuuWebHref } from "@/lib/auth/login-link";
import {
	isTuturuuuAuthConfigured,
	toSafeSession,
} from "@/lib/auth/tuturuuu-session";
import {
	buildLocalLoginPath,
	type LoginReason,
	safePostLoginPath,
} from "@/lib/auth/routes";
import {
	buildTuturuuuScopeApprovalUrl,
	isTuturuuuScopeNotAllowedError,
} from "@/lib/auth/scope-approval";

export async function GET(request: Request) {
	const configured = isTuturuuuAuthConfigured();
	const nextPath = getNextPath(request);
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		const needsScopeApproval =
			configured &&
			isTuturuuuScopeNotAllowedError({
				error: auth.error,
				status: auth.status,
			});
		const invitationUrl =
			auth.code === "PENDING_WORKSPACE_INVITE"
				? sanitizeTuturuuuWebHref(auth.invitationUrl)
				: undefined;
		return Response.json(
			{
				authenticated: false,
				code: auth.code,
				configured,
				error: auth.error,
				invitationUrl,
				loginHref: buildLoginHref(
					nextPath,
					loginReasonForAuthFailure({
						code: auth.code,
						needsScopeApproval,
						status: auth.status,
					}),
					invitationUrl,
				),
				scopeApprovalHref: needsScopeApproval
					? buildTuturuuuScopeApprovalUrl({
							appBaseUrl: new URL(request.url).origin,
							nextUrl: nextPath,
						})
					: undefined,
			},
			{ status: auth.status, headers: { "Cache-Control": "no-store" } },
		);
	}

	return Response.json(
		{
			configured: true,
			loginHref: buildLoginHref(nextPath),
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

function getNextPath(request: Request) {
	const requestUrl = new URL(request.url);
	return safePostLoginPath(requestUrl.searchParams.get("nextUrl"), requestUrl.origin);
}

function buildLoginHref(
	nextPath: string,
	reason?: LoginReason,
	invitationUrl?: string | null,
) {
	return buildLocalLoginPath(nextPath, reason, { invitationUrl });
}

function loginReasonForAuthFailure({
	code,
	needsScopeApproval,
	status,
}: {
	code?: string;
	needsScopeApproval: boolean;
	status: number;
}): LoginReason | undefined {
	if (needsScopeApproval) return "scope";
	if (code === "PENDING_WORKSPACE_INVITE") return "invitation";
	if (status === 403) return "no-access";
	if (status === 401) return "expired";
	return undefined;
}
