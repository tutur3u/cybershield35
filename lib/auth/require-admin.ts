import {
	allowLocalAuthBypass,
	createSessionCookie,
	getRequestedScopes,
	readAdminSession,
	refreshAdminSession,
	sanitizeAuthError,
	sessionCanRefresh,
	sessionNeedsIdentityRefresh,
	sessionNeedsRefresh,
	sessionNeedsScopeRefresh,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";
import {
	isTuturuuuScopeNotAllowedError,
	TUTURUUU_SCOPE_NOT_ALLOWED_ERROR,
} from "@/lib/auth/scope-approval";

export type AdminAuthResult =
	| {
			kind: "live";
			session: TuturuuuAdminSession;
			setCookie: string | null;
	  }
	| {
			code?: string;
			error: string;
			status: number;
	  };

export async function requireLocalAdminSession(
	request: Request,
): Promise<AdminAuthResult> {
	if (allowLocalAuthBypass(request)) {
		return { kind: "live", session: localDevSession(), setCookie: null };
	}

	const session = await readAdminSession(request);
	if (!session) {
		return { error: "Authentication required", status: 401 };
	}

	if (!sessionCanRefresh(session)) {
		return { error: "Tuturuuu admin session expired", status: 401 };
	}

	if (sessionNeedsScopeRefresh(session)) {
		return {
			error: TUTURUUU_SCOPE_NOT_ALLOWED_ERROR,
			status: 403,
		};
	}

	return { kind: "live", session, setCookie: null };
}

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

	if (!sessionCanRefresh(session)) {
		return { error: "Tuturuuu admin session expired", status: 401 };
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

			if (safe.status === 403) {
				return {
					code: safe.code ?? "NO_WORKSPACE_ACCESS",
					error: safe.message,
					status: safe.status,
				};
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
