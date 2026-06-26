import { buildTuturuuuCentralizedLoginUrl } from "@/lib/auth/login-link";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { requestUrlFromHeaders } from "@/lib/auth/request-url";
import {
	buildLocalLoginPath,
	isPublicAuthRoute,
	nextPathFromRequestUrl,
} from "@/lib/auth/routes";
import {
	getTuturuuuAuthDiagnostics,
	toSafeSession,
	type TuturuuuAuthDiagnostics,
	type SafeAdminSession,
} from "@/lib/auth/tuturuuu-session";
import {
	buildTuturuuuScopeApprovalUrl,
	isTuturuuuScopeNotAllowedError,
} from "@/lib/auth/scope-approval";

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
			loginPath: string;
			publicRoute?: false;
			scopeApprovalHref?: string;
			status: number;
	  }
	| {
			authenticated: false;
			authDiagnostics: TuturuuuAuthDiagnostics;
			configured: boolean;
			loginHref?: string;
			loginPath: string;
			publicRoute: true;
			status: 200;
	  };

export async function resolveDashboardAuthFromRequest(
	request: Request,
): Promise<DashboardAuthResult> {
	const requestUrl = new URL(request.url);
	const authDiagnostics = getTuturuuuAuthDiagnostics();
	const nextPath = nextPathFromRequestUrl(requestUrl);
	const loginHref = authDiagnostics.configured
		? buildTuturuuuCentralizedLoginUrl({
				appBaseUrl: requestUrl.origin,
				nextUrl: nextPath,
			})
		: undefined;
	const loginPath = buildLocalLoginPath(nextPath);

	if (isPublicAuthRoute(requestUrl.pathname)) {
		return {
			authenticated: false,
			authDiagnostics,
			configured: authDiagnostics.configured,
			loginHref,
			loginPath,
			publicRoute: true,
			status: 200,
		};
	}

	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		const scopeApprovalHref =
			authDiagnostics.configured &&
			isTuturuuuScopeNotAllowedError({
				error: auth.error,
				status: auth.status,
			})
				? buildTuturuuuScopeApprovalUrl({
						appBaseUrl: requestUrl.origin,
						nextUrl: nextPath,
					})
				: undefined;

		return {
			authenticated: false,
			authDiagnostics,
			configured: authDiagnostics.configured,
			error: auth.error,
			loginHref,
			loginPath,
			scopeApprovalHref,
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
