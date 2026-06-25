import { requireAdminSession } from "@/lib/auth/require-admin";
import {
	isTuturuuuAuthConfigured,
	toSafeSession,
	type SafeAdminSession,
} from "@/lib/auth/tuturuuu-session";

export type DashboardAuthResult =
	| {
			authenticated: true;
			session: SafeAdminSession;
	  }
	| {
			authenticated: false;
			configured: boolean;
			error: string;
			status: number;
	  };

export async function resolveDashboardAuthFromRequest(
	request: Request,
): Promise<DashboardAuthResult> {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return {
			authenticated: false,
			configured: isTuturuuuAuthConfigured(),
			error: auth.error,
			status: auth.status,
		};
	}

	return {
		authenticated: true,
		session: toSafeSession(auth.session),
	};
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

	return `${protocol}://${host}/`;
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
