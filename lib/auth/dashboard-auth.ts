import { buildTuturuuuCentralizedLoginUrl } from "@/lib/auth/login-link";
import { requireAdminSession } from "@/lib/auth/require-admin";
import {
	getTuturuuuAuthDiagnostics,
	toSafeSession,
	type TuturuuuAuthDiagnostics,
	type SafeAdminSession,
} from "@/lib/auth/tuturuuu-session";

export type DashboardAuthResult =
	| {
			authenticated: true;
			publicRoute?: false;
			session: SafeAdminSession;
	  }
	| {
			authenticated: false;
			configured: boolean;
			error: string;
			authDiagnostics: TuturuuuAuthDiagnostics;
			loginHref?: string;
			publicRoute?: false;
			status: number;
	  }
	| {
			authenticated: false;
			authDiagnostics: TuturuuuAuthDiagnostics;
			configured: boolean;
			loginHref?: string;
			publicRoute: true;
			status: 200;
	  };

export async function resolveDashboardAuthFromRequest(
	request: Request,
): Promise<DashboardAuthResult> {
	const requestUrl = new URL(request.url);
	const authDiagnostics = getTuturuuuAuthDiagnostics();
	const loginHref = authDiagnostics.configured
		? buildTuturuuuCentralizedLoginUrl({
				appBaseUrl: requestUrl.origin,
				nextUrl: `${requestUrl.pathname}${requestUrl.search}`,
			})
		: undefined;

	if (isPublicAuthRoute(requestUrl.pathname)) {
		return {
			authenticated: false,
			authDiagnostics,
			configured: authDiagnostics.configured,
			loginHref,
			publicRoute: true,
			status: 200,
		};
	}

	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return {
			authenticated: false,
			authDiagnostics,
			configured: authDiagnostics.configured,
			error: auth.error,
			loginHref,
			status: auth.status,
		};
	}

	return {
		authenticated: true,
		session: toSafeSession(auth.session),
	};
}

function isPublicAuthRoute(pathname: string) {
	return pathname === "/verify-token";
}

export async function resolveDashboardAuthFromCurrentRequest() {
	const { headers } = await import("next/headers");
	const headerStore = await headers();
	const requestHeaders = new Headers();

	for (const [key, value] of headerStore.entries()) {
		requestHeaders.set(key, value);
	}

	return resolveDashboardAuthFromRequest(
		new Request(requestUrlFromHeaders(requestHeaders), {
			headers: requestHeaders,
		}),
	);
}

function requestUrlFromHeaders(headers: Headers) {
	const host =
		firstForwardedValue(headers.get("x-forwarded-host")) ??
		firstForwardedValue(headers.get("host")) ??
		"localhost";
	const protocol =
		firstForwardedValue(headers.get("x-forwarded-proto")) ??
		(isLoopbackHost(host) ? "http" : "https");
	const pathname = safePathname(headers.get("x-cybershield-pathname"));
	const search = safeSearch(headers.get("x-cybershield-search"));

	return `${protocol}://${host}${pathname}${search}`;
}

function firstForwardedValue(value: string | null) {
	return value
		?.split(",")
		.map((part) => part.trim())
		.find(Boolean);
}

function isLoopbackHost(host: string) {
	const hostname = host.startsWith("[")
		? host.slice(1, host.indexOf("]"))
		: (host.split(":")[0] ?? "");

	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname === "0.0.0.0" ||
		hostname === "::1"
	);
}

function safePathname(value: string | null) {
	return value?.startsWith("/") ? value : "/";
}

function safeSearch(value: string | null) {
	if (!value) return "";
	return value.startsWith("?") ? value : "";
}
