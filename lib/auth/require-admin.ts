import {
	allowLocalAuthBypass,
	createSessionCookie,
	getRequestedScopes,
	refreshAdminSession,
	readAdminSession,
	sanitizeAuthError,
	sessionNeedsIdentityRefresh,
	sessionNeedsRefresh,
	sessionNeedsScopeRefresh,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";
import { isTuturuuuScopeNotAllowedError } from "@/lib/auth/scope-approval";

export type AdminAuthResult =
	| {
			kind: "live";
			session: TuturuuuAdminSession;
			setCookie: string | null;
	  }
	| {
			error: string;
			status: number;
	  };

export async function requireAdminSession(
	request: Request,
): Promise<AdminAuthResult> {
	if (allowLocalAuthBypass(request)) {
		return { kind: "live", session: localDevSession(), setCookie: null };
	}

	let session = await readAdminSession(request);
	if (!session) {
		return { error: "Authentication required", status: 401 };
	}

	if (
		sessionNeedsRefresh(session) ||
		sessionNeedsIdentityRefresh(session) ||
		sessionNeedsScopeRefresh(session)
	) {
		try {
			session = await refreshAdminSession(session);
			return {
				kind: "live",
				session,
				setCookie: createSessionCookie(session),
			};
		} catch (error) {
			const safe = sanitizeAuthError(error);
			if (
				isTuturuuuScopeNotAllowedError({
					error: safe.message,
					status: safe.status,
				})
			) {
				return { error: safe.message, status: safe.status };
			}

			return { error: "Tuturuuu admin session expired", status: 401 };
		}
	}

	return { kind: "live", session, setCookie: null };
}

function localDevSession(): TuturuuuAdminSession {
	const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
	return {
		accessToken: "local-dev-bypass",
		app: { name: "cybershield35-local" },
		createdAt: new Date().toISOString(),
		expiresAt,
		expiresIn: 3600,
		refreshEarlySeconds: 60,
		refreshExpiresAt: expiresAt,
		refreshExpiresIn: 3600,
		refreshToken: "local-dev-bypass",
		scopes: getRequestedScopes(),
		tokenType: "Bearer",
		user: {
			displayName: "Local Admin",
			email: "local@localhost",
			id: "local-dev",
		},
		workspaceId: "local-dev",
	};
}

export function authHeaders(result: AdminAuthResult) {
	return "setCookie" in result && result.setCookie
		? { "Set-Cookie": result.setCookie }
		: undefined;
}
