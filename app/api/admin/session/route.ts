import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { buildTuturuuuCentralizedLoginUrl, sanitizeNextPath } from "@/lib/auth/login-link";
import {
	isTuturuuuAuthConfigured,
	toSafeSession,
} from "@/lib/auth/tuturuuu-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
	const configured = isTuturuuuAuthConfigured();
	const loginHref = configured ? buildLoginHref(request) : undefined;
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json(
			{
				authenticated: false,
				configured,
				error: auth.error,
				loginHref,
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

function buildLoginHref(request: Request) {
	const requestUrl = new URL(request.url);
	const nextUrl = sanitizeNextPath(requestUrl.searchParams.get("nextUrl"), requestUrl.origin);

	return buildTuturuuuCentralizedLoginUrl({
		appBaseUrl: requestUrl.origin,
		nextUrl,
	});
}
