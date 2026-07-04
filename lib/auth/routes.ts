import { sanitizeNextPath } from "@/lib/auth/login-link";

export const LOGIN_PATHNAME = "/login";
export const VERIFY_TOKEN_PATHNAME = "/verify-token";
export const LOGIN_REASONS = [
	"expired",
	"invalid-link",
	"invitation",
	"logged-out",
	"no-access",
	"scope",
] as const;

export type LoginReason = (typeof LOGIN_REASONS)[number];

export function isPublicAuthRoute(pathname: string) {
	return pathname === LOGIN_PATHNAME || pathname === VERIFY_TOKEN_PATHNAME;
}

export function nextPathFromRequestUrl(requestUrl: URL) {
	if (requestUrl.pathname === LOGIN_PATHNAME) {
		return safePostLoginPath(requestUrl.searchParams.get("nextUrl"), requestUrl.origin);
	}

	return `${requestUrl.pathname}${requestUrl.search}`;
}

export function buildLocalLoginPath(
	nextPath = "/",
	reason?: LoginReason | null,
	options: { invitationUrl?: string | null } = {},
) {
	const safeNextPath = normalizeInternalPath(nextPath);
	const params = new URLSearchParams({ nextUrl: safeNextPath });
	const safeReason = safeLoginReason(reason);
	if (safeReason) params.set("reason", safeReason);
	if (safeReason === "invitation" && options.invitationUrl) {
		params.set("invitationUrl", options.invitationUrl);
	}
	return `${LOGIN_PATHNAME}?${params.toString()}`;
}

export function safeLoginReason(rawValue: string | null | undefined) {
	return LOGIN_REASONS.find((reason) => reason === rawValue) ?? null;
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
