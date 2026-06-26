import { sanitizeNextPath } from "@/lib/auth/login-link";

export const LOGIN_PATHNAME = "/login";
export const VERIFY_TOKEN_PATHNAME = "/verify-token";

export function isPublicAuthRoute(pathname: string) {
	return pathname === LOGIN_PATHNAME || pathname === VERIFY_TOKEN_PATHNAME;
}

export function nextPathFromRequestUrl(requestUrl: URL) {
	if (requestUrl.pathname === LOGIN_PATHNAME) {
		return safePostLoginPath(requestUrl.searchParams.get("nextUrl"), requestUrl.origin);
	}

	return `${requestUrl.pathname}${requestUrl.search}`;
}

export function buildLocalLoginPath(nextPath = "/") {
	const safeNextPath = normalizeInternalPath(nextPath);
	const params = new URLSearchParams({ nextUrl: safeNextPath });
	return `${LOGIN_PATHNAME}?${params.toString()}`;
}

export function safePostLoginPath(
	rawValue: string | null | undefined,
	requestOrigin: string,
) {
	const nextPath = sanitizeNextPath(rawValue, requestOrigin);
	return isLoginPath(nextPath) ? "/" : nextPath;
}

function normalizeInternalPath(nextPath: string) {
	if (!nextPath.startsWith("/") || nextPath.startsWith("//")) return "/";
	return isLoginPath(nextPath) ? "/" : nextPath;
}

function isLoginPath(pathname: string) {
	return pathname === LOGIN_PATHNAME || pathname.startsWith(`${LOGIN_PATHNAME}?`);
}
