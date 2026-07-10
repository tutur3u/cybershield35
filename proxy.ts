import { NextResponse, type NextRequest } from "next/server";

import {
	allowLocalAuthBypass,
	clearSessionCookie,
	createSessionCookie,
	readAdminSession,
	refreshAdminSession,
	sanitizeAuthError,
	sessionCanRefresh,
	sessionNeedsIdentityRefresh,
	sessionNeedsRefresh,
	sessionNeedsScopeRefresh,
} from "@/lib/auth/tuturuuu-session";
import {
	LOGIN_PATHNAME,
	VERIFY_TOKEN_PATHNAME,
	buildLocalLoginPath,
	safePostLoginPath,
} from "@/lib/auth/routes";
import { isTuturuuuScopeNotAllowedError } from "@/lib/auth/scope-approval";

export async function proxy(request: NextRequest) {
	const continueRequest = (setCookie?: string | null) => {
		const requestHeaders = new Headers(request.headers);
		requestHeaders.set("x-cybershield-pathname", request.nextUrl.pathname);
		requestHeaders.set("x-cybershield-search", request.nextUrl.search);
		if (setCookie) applySessionCookieToRequest(requestHeaders, setCookie);

		const response = NextResponse.next({
			request: {
				headers: requestHeaders,
			},
		});
		return attachSessionCookie(response, setCookie);
	};

	const pathname = request.nextUrl.pathname;
	if (pathname === VERIFY_TOKEN_PATHNAME || isPublicFilePath(pathname)) {
		return continueRequest();
	}

	let session = await readAdminSession(request);
	const localBypass = allowLocalAuthBypass(request);
	let setCookie: string | null = null;
	let loginReason: "expired" | "invitation" | "no-access" | "scope" | undefined;

	if (pathname === LOGIN_PATHNAME) {
		if (!(localBypass || isUsableSession(session))) return continueRequest();

		return NextResponse.redirect(
			new URL(
				safePostLoginPath(
					request.nextUrl.searchParams.get("nextUrl"),
					request.nextUrl.origin,
				),
				request.nextUrl,
			),
		);
	}

	if (!localBypass && session && sessionCanRefresh(session)) {
		const needsScopeRefresh = sessionNeedsScopeRefresh(session);
		if (
			sessionNeedsRefresh(session) ||
			sessionNeedsIdentityRefresh(session) ||
			needsScopeRefresh
		) {
			try {
				session = await refreshAdminSession(session);
				setCookie = createSessionCookie(session);
			} catch (error) {
				const safe = sanitizeAuthError(error);
				loginReason =
					safe.code === "PENDING_WORKSPACE_INVITE"
						? "invitation"
						: needsScopeRefresh ||
							isTuturuuuScopeNotAllowedError({
								error: safe.message,
								status: safe.status,
							})
							? "scope"
							: safe.status === 403
								? "no-access"
								: "expired";
				if (loginReason !== "scope") {
					setCookie = clearSessionCookie();
				}
				session = null;
			}
		}
	} else if (!localBypass && session) {
		loginReason = sessionNeedsScopeRefresh(session) ? "scope" : "expired";
		if (loginReason !== "scope") setCookie = clearSessionCookie();
		session = null;
	}

	const authenticated = localBypass || isUsableSession(session);

	if (!authenticated) {
		return attachSessionCookie(
			NextResponse.redirect(
				new URL(
					buildLocalLoginPath(
						`${request.nextUrl.pathname}${request.nextUrl.search}`,
						loginReason,
					),
					request.nextUrl,
				),
			),
			setCookie,
		);
	}

	return continueRequest(setCookie);
}

function isUsableSession(session: Awaited<ReturnType<typeof readAdminSession>>) {
	return Boolean(
		session && sessionCanRefresh(session) && !sessionNeedsScopeRefresh(session),
	);
}

function isPublicFilePath(pathname: string) {
	return pathname.includes(".");
}

function attachSessionCookie<T extends NextResponse>(
	response: T,
	setCookie?: string | null,
) {
	if (setCookie) response.headers.set("Set-Cookie", setCookie);
	return response;
}

function applySessionCookieToRequest(headers: Headers, setCookie: string) {
	const cookiePair = setCookie.split(";", 1)[0];
	if (!cookiePair) return;

	const separator = cookiePair.indexOf("=");
	if (separator <= 0) return;
	const name = cookiePair.slice(0, separator);
	const existing = (headers.get("cookie") ?? "")
		.split(/;\s*/u)
		.filter(Boolean)
		.filter((cookie) => cookie.slice(0, cookie.indexOf("=")) !== name);
	existing.push(cookiePair);
	headers.set("cookie", existing.join("; "));
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
