import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import {
	isTuturuuuAuthConfigured,
	toSafeSession,
} from "@/lib/auth/tuturuuu-session";
import { buildLocalLoginPath, safePostLoginPath } from "@/lib/auth/routes";

export const runtime = "nodejs";

export async function GET(request: Request) {
	const configured = isTuturuuuAuthConfigured();
	const loginHref = buildLoginHref(request);
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
	return buildLocalLoginPath(
		safePostLoginPath(requestUrl.searchParams.get("nextUrl"), requestUrl.origin),
	);
}
