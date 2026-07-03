import { NextResponse, type NextRequest } from "next/server";

import {
	allowLocalAuthBypass,
	readAdminSession,
	sessionCanRefresh,
} from "@/lib/auth/tuturuuu-session";
import {
	LOGIN_PATHNAME,
	VERIFY_TOKEN_PATHNAME,
	buildLocalLoginPath,
	safePostLoginPath,
} from "@/lib/auth/routes";

export async function proxy(request: NextRequest) {
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-cybershield-pathname", request.nextUrl.pathname);
	requestHeaders.set("x-cybershield-search", request.nextUrl.search);

	const continueRequest = () =>
		NextResponse.next({
			request: {
				headers: requestHeaders,
			},
		});

	const pathname = request.nextUrl.pathname;
	if (pathname === VERIFY_TOKEN_PATHNAME || isPublicFilePath(pathname)) {
		return continueRequest();
	}

	const session = await readAdminSession(request);
	const authenticated = allowLocalAuthBypass(request) || isUsableSession(session);

	if (pathname === LOGIN_PATHNAME) {
		if (!authenticated) return continueRequest();

		return NextResponse.redirect(
			new URL(
				safePostLoginPath(request.nextUrl.searchParams.get("nextUrl"), request.nextUrl.origin),
				request.nextUrl,
			),
		);
	}

	if (!authenticated) {
		return NextResponse.redirect(
			new URL(
				buildLocalLoginPath(
					`${request.nextUrl.pathname}${request.nextUrl.search}`,
					session ? "expired" : undefined,
				),
				request.nextUrl,
			),
		);
	}

	return continueRequest();
}

function isUsableSession(session: Awaited<ReturnType<typeof readAdminSession>>) {
	return Boolean(session && sessionCanRefresh(session));
}

function isPublicFilePath(pathname: string) {
	return pathname.includes(".");
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
