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
	clearLocalSessionCookie,
	readLocalSessionCookie,
	type LocalSessionCookie,
} from "@/lib/auth/local-session";
import {
	isTuturuuuScopeNotAllowedError,
	TUTURUUU_SCOPE_NOT_ALLOWED_ERROR,
} from "@/lib/auth/scope-approval";

export const LOCAL_ACCOUNT_PLATFORM_ERROR =
	"Tính năng này cần đăng nhập bằng tài khoản Tuturuuu.";

export type AdminAuthResult =
	| {
			kind: "live" | "local";
			session: TuturuuuAdminSession;
			setCookie: string | null;
	  }
	| {
			code?: string;
			error: string;
			setCookie?: string | null;
			status: number;
	  };

/** The authenticated arm of {@link AdminAuthResult}, whichever credential issued it. */
export type AdminSessionAuth = Extract<
	AdminAuthResult,
	{ session: TuturuuuAdminSession }
>;

export async function requireLocalAdminSession(
	request: Request,
): Promise<AdminAuthResult> {
	if (allowLocalAuthBypass(request)) {
		return { kind: "live", session: localDevSession(), setCookie: null };
	}

	const local = await resolveLocalAccountSession(request);
	if (local) return local;

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

	const local = await resolveLocalAccountSession(request);
	if (local) return local;

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

/**
 * For routes that spend the caller's Tuturuuu access token upstream (Drive,
 * profile, workspace APIs). Local password accounts have no platform identity,
 * so they are refused here instead of failing with an opaque upstream 401.
 */
export async function requirePlatformAdminSession(
	request: Request,
): Promise<AdminAuthResult> {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return auth;
	if (auth.kind === "local") {
		return {
			code: "LOCAL_ACCOUNT_NOT_SUPPORTED",
			error: LOCAL_ACCOUNT_PLATFORM_ERROR,
			status: 403,
		};
	}
	return auth;
}

export function isLocalAccountSession(session: TuturuuuAdminSession) {
	return Boolean(session.localAccount);
}

async function resolveLocalAccountSession(
	request: Request,
): Promise<AdminAuthResult | null> {
	const cookie = readLocalSessionCookie(request);
	if (!cookie) return null;

	// Imported lazily so request paths without a local cookie never pull the
	// database client into the module graph.
	const { validateLocalSession } = await import("@/lib/auth/local-accounts");
	const validated = await validateLocalSession(cookie).catch(() => null);
	if (!validated) {
		return {
			error: "Phiên đăng nhập đã hết hạn.",
			setCookie: clearLocalSessionCookie(),
			status: 401,
		};
	}

	return {
		kind: "local",
		session: localAccountSession(validated.cookie),
		setCookie: null,
	};
}

export function localAccountSession(
	cookie: LocalSessionCookie,
): TuturuuuAdminSession {
	return {
		// A sentinel rather than an empty string: if any code path ever forwards
		// it upstream, Tuturuuu rejects it outright instead of sending a blank
		// bearer header.
		accessToken: "cybershield35-local-account",
		app: { name: "cybershield35" },
		createdAt: cookie.issuedAt,
		expiresAt: cookie.expiresAt,
		localAccount: {
			accountId: cookie.accountId,
			mustChangePassword: cookie.mustChangePassword,
			role: cookie.role,
			sessionId: cookie.sessionId,
			username: cookie.username,
		},
		refreshExpiresAt: cookie.expiresAt,
		refreshToken: "cybershield35-local-account",
		scopes: [],
		tokenType: "Bearer",
		user: {
			avatarUrl: null,
			displayName: cookie.displayName ?? cookie.username,
			email: null,
			id: `local:${cookie.accountId}`,
		},
		workspaceId: null,
	};
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
