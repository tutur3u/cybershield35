import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import {
	isTuturuuuAuthConfigured,
	toSafeSession,
} from "@/lib/auth/tuturuuu-session";
import { buildLocalLoginPath, safePostLoginPath } from "@/lib/auth/routes";
import {
	buildTuturuuuScopeApprovalUrl,
	isTuturuuuScopeNotAllowedError,
} from "@/lib/auth/scope-approval";

export const runtime = "nodejs";

export async function GET(request: Request) {
	const configured = isTuturuuuAuthConfigured();
	const nextPath = getNextPath(request);
	const loginHref = buildLoginHref(nextPath);
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json(
			{
				authenticated: false,
				configured,
				error: auth.error,
				loginHref,
				scopeApprovalHref:
					configured &&
					isTuturuuuScopeNotAllowedError({
						error: auth.error,
						status: auth.status,
					})
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
			loginHref,
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

function buildLoginHref(nextPath: string) {
	return buildLocalLoginPath(nextPath);
}
