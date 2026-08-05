import "server-only";

import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";

import type { LocalAccountView } from "@/components/dashboard/types";
import {
	generateLocalPassword,
	hashLocalPassword,
	localPasswordIssue,
	localUsernameIssue,
	normalizeLocalUsername,
	verifyLocalPassword,
} from "@/lib/auth/local-password";
import {
	createLocalSessionToken,
	hashLocalSessionToken,
	LOCAL_SESSION_MAX_AGE_SECONDS,
	type LocalSessionCookie,
} from "@/lib/auth/local-session";
import { adminDb } from "@/lib/db/client";
import {
	localAccountSessions,
	localAccounts,
	type LocalAccountRole,
	type LocalAccountRow,
} from "@/lib/db/schema";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const GENERIC_LOGIN_ERROR = "Tên đăng nhập hoặc mật khẩu không đúng.";

export type LocalAccountActor = {
	displayName: string | null;
	id: string;
};

export class LocalAccountError extends Error {
	constructor(
		message: string,
		readonly status = 400,
	) {
		super(message);
		this.name = "LocalAccountError";
	}
}

export async function listLocalAccounts(): Promise<LocalAccountView[]> {
	const rows = await adminDb
		.select()
		.from(localAccounts)
		.orderBy(desc(localAccounts.createdAt));
	const sessionCounts = await countActiveSessions();

	return rows.map((row) => toLocalAccountView(row, sessionCounts.get(row.id) ?? 0));
}

export async function createLocalAccount(input: {
	actor: LocalAccountActor;
	displayName?: string | null;
	mustChangePassword?: boolean;
	password?: string | null;
	role?: LocalAccountRole;
	username: string;
}) {
	const username = requireValidUsername(input.username);
	const password = input.password?.trim()
		? requireValidPassword(input.password)
		: generateLocalPassword();

	const existing = await findByUsername(username);
	if (existing) {
		throw new LocalAccountError("Tên đăng nhập đã tồn tại.", 409);
	}

	const [row] = await adminDb
		.insert(localAccounts)
		.values({
			createdByDisplayName: input.actor.displayName,
			createdByUserId: input.actor.id,
			displayName: cleanDisplayName(input.displayName),
			mustChangePassword: input.mustChangePassword ?? true,
			passwordHash: await hashLocalPassword(password),
			role: input.role ?? "member",
			updatedByUserId: input.actor.id,
			username,
		})
		.returning();

	if (!row) throw new LocalAccountError("Không thể tạo tài khoản.", 500);

	// The plaintext password is returned exactly once, at creation time, so the
	// admin can hand it over. It is never stored or logged.
	return { account: toLocalAccountView(row, 0), password };
}

export async function updateLocalAccount(
	id: string,
	input: {
		actor: LocalAccountActor;
		disabled?: boolean;
		displayName?: string | null;
		mustChangePassword?: boolean;
		role?: LocalAccountRole;
		username?: string;
	},
) {
	const current = await findById(id);
	if (input.username !== undefined) {
		const username = requireValidUsername(input.username);
		const conflict = await findByUsername(username);
		if (conflict && conflict.id !== id) {
			throw new LocalAccountError("Tên đăng nhập đã tồn tại.", 409);
		}
	}

	const [row] = await adminDb
		.update(localAccounts)
		.set({
			...(input.disabled === undefined ? {} : { disabled: input.disabled }),
			...(input.displayName === undefined
				? {}
				: { displayName: cleanDisplayName(input.displayName) }),
			...(input.mustChangePassword === undefined
				? {}
				: { mustChangePassword: input.mustChangePassword }),
			...(input.role === undefined ? {} : { role: input.role }),
			...(input.username === undefined
				? {}
				: { username: normalizeLocalUsername(input.username) }),
			// Re-enabling an account should also clear any standing lockout, or the
			// operator stays locked out for reasons the admin cannot see.
			...(input.disabled === false ? { failedAttempts: 0, lockedUntil: null } : {}),
			updatedAt: new Date(),
			updatedByUserId: input.actor.id,
		})
		.where(eq(localAccounts.id, current.id))
		.returning();

	if (!row) throw new LocalAccountError("Không thể cập nhật tài khoản.", 500);

	if (input.disabled === true) await revokeLocalAccountSessions(row.id);

	const sessionCounts = await countActiveSessions(row.id);
	return toLocalAccountView(row, sessionCounts.get(row.id) ?? 0);
}

export async function setLocalAccountPassword(
	id: string,
	input: {
		actor: LocalAccountActor;
		mustChangePassword?: boolean;
		password?: string | null;
	},
) {
	const current = await findById(id);
	const password = input.password?.trim()
		? requireValidPassword(input.password)
		: generateLocalPassword();

	const [row] = await adminDb
		.update(localAccounts)
		.set({
			failedAttempts: 0,
			lockedUntil: null,
			mustChangePassword: input.mustChangePassword ?? true,
			passwordHash: await hashLocalPassword(password),
			passwordUpdatedAt: new Date(),
			updatedAt: new Date(),
			updatedByUserId: input.actor.id,
		})
		.where(eq(localAccounts.id, current.id))
		.returning();

	if (!row) throw new LocalAccountError("Không thể đặt lại mật khẩu.", 500);

	// A password reset must not leave old cookies usable.
	await revokeLocalAccountSessions(row.id);

	return { account: toLocalAccountView(row, 0), password };
}

export async function deleteLocalAccount(id: string) {
	const current = await findById(id);
	await adminDb.delete(localAccounts).where(eq(localAccounts.id, current.id));
	return { id: current.id, username: current.username };
}

export async function revokeLocalAccountSessions(accountId: string) {
	await adminDb
		.update(localAccountSessions)
		.set({ revokedAt: new Date() })
		.where(
			and(
				eq(localAccountSessions.accountId, accountId),
				isNull(localAccountSessions.revokedAt),
			),
		);
}

export async function authenticateLocalAccount(input: {
	password: string;
	userAgent?: string | null;
	username: string;
}): Promise<LocalSessionCookie> {
	const username = normalizeLocalUsername(input.username);
	const account = username ? await findByUsername(username) : null;

	if (!account) {
		// Burn comparable time on unknown usernames so response timing does not
		// disclose which accounts exist.
		await hashLocalPassword(input.password || "placeholder-password");
		throw new LocalAccountError(GENERIC_LOGIN_ERROR, 401);
	}

	if (account.disabled) {
		throw new LocalAccountError("Tài khoản đã bị vô hiệu hóa.", 403);
	}

	if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
		throw new LocalAccountError(
			`Tài khoản tạm khóa do đăng nhập sai nhiều lần. Thử lại sau ${remainingLockMinutes(account.lockedUntil)} phút.`,
			429,
		);
	}

	const valid = await verifyLocalPassword(input.password, account.passwordHash);
	if (!valid) {
		await registerFailedAttempt(account);
		throw new LocalAccountError(GENERIC_LOGIN_ERROR, 401);
	}

	const now = new Date();
	const expiresAt = new Date(now.getTime() + LOCAL_SESSION_MAX_AGE_SECONDS * 1000);
	const token = createLocalSessionToken();
	const [session] = await adminDb
		.insert(localAccountSessions)
		.values({
			accountId: account.id,
			expiresAt,
			tokenHash: hashLocalSessionToken(token),
			userAgent: input.userAgent?.slice(0, 512) ?? null,
		})
		.returning({ id: localAccountSessions.id });

	if (!session) throw new LocalAccountError("Không thể tạo phiên đăng nhập.", 500);

	await adminDb
		.update(localAccounts)
		.set({ failedAttempts: 0, lastLoginAt: now, lockedUntil: null })
		.where(eq(localAccounts.id, account.id));

	return {
		accountId: account.id,
		displayName: account.displayName,
		expiresAt: expiresAt.toISOString(),
		issuedAt: now.toISOString(),
		mustChangePassword: account.mustChangePassword,
		role: account.role,
		sessionId: session.id,
		token,
		username: account.username,
	};
}

export type ValidatedLocalSession = {
	account: LocalAccountRow;
	cookie: LocalSessionCookie;
};

/**
 * Confirms the cookie still maps to a live, unrevoked session row and an enabled
 * account. Everything downstream of the proxy uses this, never the cookie alone.
 */
export async function validateLocalSession(
	cookie: LocalSessionCookie,
): Promise<ValidatedLocalSession | null> {
	const [row] = await adminDb
		.select({ account: localAccounts, sessionId: localAccountSessions.id })
		.from(localAccountSessions)
		.innerJoin(localAccounts, eq(localAccounts.id, localAccountSessions.accountId))
		.where(
			and(
				eq(localAccountSessions.id, cookie.sessionId),
				eq(localAccountSessions.tokenHash, hashLocalSessionToken(cookie.token)),
				isNull(localAccountSessions.revokedAt),
				sql`${localAccountSessions.expiresAt} > now()`,
				eq(localAccounts.disabled, false),
			),
		)
		.limit(1);

	if (!row) return null;

	return {
		account: row.account,
		cookie: {
			...cookie,
			displayName: row.account.displayName,
			mustChangePassword: row.account.mustChangePassword,
			role: row.account.role,
			username: row.account.username,
		},
	};
}

export async function touchLocalSession(sessionId: string) {
	await adminDb
		.update(localAccountSessions)
		.set({ lastSeenAt: new Date() })
		.where(eq(localAccountSessions.id, sessionId));
}

export async function revokeLocalSession(sessionId: string) {
	await adminDb
		.update(localAccountSessions)
		.set({ revokedAt: new Date() })
		.where(eq(localAccountSessions.id, sessionId));
}

export async function changeOwnLocalPassword(input: {
	accountId: string;
	currentPassword: string;
	newPassword: string;
	sessionId: string;
}) {
	const account = await findById(input.accountId);
	const valid = await verifyLocalPassword(
		input.currentPassword,
		account.passwordHash,
	);
	if (!valid) {
		throw new LocalAccountError("Mật khẩu hiện tại không đúng.", 401);
	}

	const password = requireValidPassword(input.newPassword);
	if (await verifyLocalPassword(password, account.passwordHash)) {
		throw new LocalAccountError("Mật khẩu mới phải khác mật khẩu hiện tại.", 400);
	}

	await adminDb
		.update(localAccounts)
		.set({
			failedAttempts: 0,
			lockedUntil: null,
			mustChangePassword: false,
			passwordHash: await hashLocalPassword(password),
			passwordUpdatedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(localAccounts.id, account.id));

	// Every other device is signed out; the session doing the change survives.
	await adminDb
		.update(localAccountSessions)
		.set({ revokedAt: new Date() })
		.where(
			and(
				eq(localAccountSessions.accountId, account.id),
				isNull(localAccountSessions.revokedAt),
				sql`${localAccountSessions.id} <> ${input.sessionId}::uuid`,
			),
		);
}

export async function purgeExpiredLocalSessions() {
	await adminDb
		.delete(localAccountSessions)
		.where(
			or(
				lt(localAccountSessions.expiresAt, new Date()),
				lt(
					localAccountSessions.revokedAt,
					new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
				),
			),
		);
}

async function registerFailedAttempt(account: LocalAccountRow) {
	const attempts = account.failedAttempts + 1;
	const locked = attempts >= MAX_FAILED_ATTEMPTS;

	await adminDb
		.update(localAccounts)
		.set({
			failedAttempts: locked ? 0 : attempts,
			lockedUntil: locked
				? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
				: account.lockedUntil,
		})
		.where(eq(localAccounts.id, account.id));
}

async function countActiveSessions(accountId?: string) {
	const rows = await adminDb
		.select({
			accountId: localAccountSessions.accountId,
			total: sql<number>`count(*)::int`,
		})
		.from(localAccountSessions)
		.where(
			and(
				isNull(localAccountSessions.revokedAt),
				sql`${localAccountSessions.expiresAt} > now()`,
				...(accountId ? [eq(localAccountSessions.accountId, accountId)] : []),
			),
		)
		.groupBy(localAccountSessions.accountId);

	return new Map(rows.map((row) => [row.accountId, row.total]));
}

async function findByUsername(username: string) {
	const [row] = await adminDb
		.select()
		.from(localAccounts)
		.where(eq(localAccounts.username, username))
		.limit(1);
	return row ?? null;
}

async function findById(id: string) {
	const [row] = await adminDb
		.select()
		.from(localAccounts)
		.where(eq(localAccounts.id, id))
		.limit(1);
	if (!row) throw new LocalAccountError("Không tìm thấy tài khoản.", 404);
	return row;
}

function requireValidUsername(rawValue: string) {
	const username = normalizeLocalUsername(rawValue);
	const issue = localUsernameIssue(username);
	if (issue) throw new LocalAccountError(issue, 400);
	return username;
}

function requireValidPassword(rawValue: string) {
	const issue = localPasswordIssue(rawValue);
	if (issue) throw new LocalAccountError(issue, 400);
	return rawValue;
}

function cleanDisplayName(value: string | null | undefined) {
	const cleaned = value?.trim();
	return cleaned ? cleaned.slice(0, 120) : null;
}

function remainingLockMinutes(lockedUntil: Date) {
	return Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
}

function toLocalAccountView(
	row: LocalAccountRow,
	activeSessions: number,
): LocalAccountView {
	return {
		activeSessions,
		createdAt: row.createdAt.toISOString(),
		createdByDisplayName: row.createdByDisplayName,
		disabled: row.disabled,
		displayName: row.displayName,
		id: row.id,
		lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
		lockedUntil:
			row.lockedUntil && row.lockedUntil.getTime() > Date.now()
				? row.lockedUntil.toISOString()
				: null,
		mustChangePassword: row.mustChangePassword,
		passwordUpdatedAt: row.passwordUpdatedAt.toISOString(),
		role: row.role,
		username: row.username,
	};
}
