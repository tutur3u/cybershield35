import {
	createSessionCookie,
	refreshAdminSession,
	readAdminSession,
	sessionNeedsRefresh,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";

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

export async function requireAdminSession(request: Request): Promise<AdminAuthResult> {
	let session = await readAdminSession(request);
	if (!session) {
		return { error: "Authentication required", status: 401 };
	}

	if (sessionNeedsRefresh(session)) {
		try {
			session = await refreshAdminSession(session);
			return {
				kind: "live",
				session,
				setCookie: createSessionCookie(session),
			};
		} catch {
			return { error: "Tuturuuu admin session expired", status: 401 };
		}
	}

	return { kind: "live", session, setCookie: null };
}

export function authHeaders(result: AdminAuthResult) {
	return "setCookie" in result && result.setCookie
		? { "Set-Cookie": result.setCookie }
		: undefined;
}
