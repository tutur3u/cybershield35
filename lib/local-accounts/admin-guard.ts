import "server-only";

import type { LocalAccountActor } from "@/lib/auth/local-accounts";
import { requirePlatformAdminSession } from "@/lib/auth/require-admin";
import { toSafeSession } from "@/lib/auth/tuturuuu-session";
import { fetchWorkspaceMembersForRequest } from "@/lib/workspace-members/proxy";

export const LOCAL_ACCOUNT_ADMIN_ERROR =
	"Chỉ quản trị viên workspace mới quản lý được tài khoản mật khẩu.";

export type LocalAccountAdminGuard =
	| { actor: LocalAccountActor; authorized: true; setCookie: string | null }
	| { authorized: false; error: string; status: number };

/**
 * Password logins are workspace credentials, so only a live Tuturuuu session
 * that Tuturuuu itself reports as a workspace member-manager may issue or revoke
 * them. A local password session can never manage other local accounts, which
 * keeps the platform as the single root of trust.
 */
export async function requireLocalAccountAdmin(
	request: Request,
): Promise<LocalAccountAdminGuard> {
	const auth = await requirePlatformAdminSession(request);
	if ("error" in auth) {
		return { authorized: false, error: auth.error, status: auth.status };
	}

	let canManage = false;
	try {
		const members = await fetchWorkspaceMembersForRequest(request);
		canManage = Boolean(members.context?.canManageMembers);
	} catch {
		return {
			authorized: false,
			error: "Không xác minh được quyền quản trị workspace.",
			status: 503,
		};
	}

	if (!canManage) {
		return {
			authorized: false,
			error: LOCAL_ACCOUNT_ADMIN_ERROR,
			status: 403,
		};
	}

	const safeSession = toSafeSession(auth.session);
	return {
		actor: {
			displayName: safeSession.user.displayName ?? safeSession.user.email,
			id: safeSession.user.id,
		},
		authorized: true,
		setCookie: auth.setCookie,
	};
}

export function localAccountJson(
	body: unknown,
	options: { setCookie?: string | null; status?: number } = {},
) {
	const headers = new Headers({ "Cache-Control": "no-store" });
	if (options.setCookie) headers.set("Set-Cookie", options.setCookie);
	return Response.json(body, { headers, status: options.status });
}
