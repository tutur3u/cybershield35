import { buildTuturuuuCentralizedLoginUrl } from "@/lib/auth/login-link";
import { requireAdminSession } from "@/lib/auth/require-admin";
import {
	buildLocalLoginPath,
	isPublicAuthRoute,
	type LoginReason,
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
		const needsScopeApproval =
			authDiagnostics.configured &&
			isTuturuuuScopeNotAllowedError({
				error: auth.error,
				status: auth.status,
			});
		const scopeApprovalHref = needsScopeApproval
			? buildTuturuuuScopeApprovalUrl({
					appBaseUrl: requestUrl.origin,
					nextUrl: nextPath,
				})
			: undefined;
		const loginReason = loginReasonForAuthFailure({
			code: auth.code,
			needsScopeApproval,
			status: auth.status,
		});

		return {
			authenticated: false,
			authDiagnostics,
			configured: authDiagnostics.configured,
			error: auth.error,
			loginHref,
			loginPath: buildLocalLoginPath(nextPath, loginReason, {
				invitationUrl: auth.invitationUrl,
			}),
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
	const { requestFromCurrentHeaders } = await import("@/lib/auth/current-request");
	return resolveDashboardAuthFromRequest(await requestFromCurrentHeaders());
}

function loginReasonForAuthFailure({
	code,
	needsScopeApproval,
	status,
}: {
	code?: string;
	needsScopeApproval: boolean;
	status: number;
}): LoginReason | undefined {
	if (needsScopeApproval) return "scope";
	if (code === "PENDING_WORKSPACE_INVITE") return "invitation";
	if (status === 403) return "no-access";
	if (status === 401) return "expired";
	return undefined;
}
