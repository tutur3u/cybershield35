import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

import {
	generateLocalPassword,
	hashLocalPassword,
	localPasswordIssue,
	localUsernameIssue,
	normalizeLocalUsername,
	verifyLocalPassword,
} from "@/lib/auth/local-password";
import {
	clearLocalSessionCookie,
	createLocalSessionCookie,
	hashLocalSessionToken,
	LOCAL_SESSION_COOKIE_NAME,
	readLocalSessionCookie,
	type LocalSessionCookie,
} from "@/lib/auth/local-session";
import {
	getRequestedScopes,
	toSafeSession,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";
import { proxy } from "@/proxy";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

const accountId = "8f2f4d3c-1a2b-4c5d-8e9f-0a1b2c3d4e5f";
const sessionId = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

function localSession(
	overrides: Partial<LocalSessionCookie> = {},
): LocalSessionCookie {
	return {
		accountId,
		displayName: "Cán bộ Truyền thông",
		expiresAt: new Date(Date.now() + 3600_000).toISOString(),
		issuedAt: new Date().toISOString(),
		mustChangePassword: false,
		role: "member",
		sessionId,
		token: "local-session-token-value-0123456789",
		username: "canbo.truyenthong",
		...overrides,
	};
}

function tuturuuuSession(): TuturuuuAdminSession {
	return {
		accessToken: "access-token",
		app: { name: "cybershield35" },
		createdAt: new Date().toISOString(),
		expiresAt: new Date(Date.now() + 60_000).toISOString(),
		refreshExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
		refreshToken: "refresh-token",
		scopes: getRequestedScopes(),
		tokenType: "Bearer",
		user: { displayName: "Admin", email: "admin@example.com", id: "user-1" },
		workspaceId: "workspace-1",
	};
}

function requestWithLocalCookie(url = "https://cybershield.example.com/sources") {
	return new Request(url, {
		headers: { cookie: createLocalSessionCookie(localSession()) },
	});
}

class StubLocalAccountError extends Error {
	constructor(
		message: string,
		readonly status = 400,
	) {
		super(message);
	}
}

/**
 * The account store talks to Postgres, so every test stubs the whole module.
 * The surface is declared in one place because a partial module mock leaves the
 * remaining named imports unresolvable.
 */
function stubLocalAccounts(overrides: Record<string, unknown> = {}) {
	mock.module("@/lib/auth/local-accounts", () => ({
		authenticateLocalAccount: async () => localSession(),
		changeOwnLocalPassword: async () => undefined,
		createLocalAccount: async () => ({ account: {}, password: "" }),
		deleteLocalAccount: async () => ({ id: accountId, username: "" }),
		listLocalAccounts: async () => [],
		LocalAccountError: StubLocalAccountError,
		purgeExpiredLocalSessions: async () => undefined,
		revokeLocalAccountSessions: async () => undefined,
		revokeLocalSession: async () => undefined,
		setLocalAccountPassword: async () => ({ account: {}, password: "" }),
		touchLocalSession: async () => undefined,
		updateLocalAccount: async () => ({}),
		validateLocalSession: async (cookie: LocalSessionCookie) => ({
			account: {},
			cookie,
		}),
		...overrides,
	}));
}

beforeEach(() => {
	process.env.CYBERSHIELD35_SESSION_SECRET =
		"test-secret-for-cybershield35-session-cookie";
	process.env.NODE_ENV = "production";
	// The guard modules are server-only; the test runner has no RSC boundary.
	mock.module("server-only", () => ({}));
});

afterEach(() => {
	process.env = { ...originalEnv };
	globalThis.fetch = originalFetch;
	mock.restore();
});

describe("local account passwords", () => {
	test("round-trips a password through scrypt without storing it", async () => {
		const stored = await hashLocalPassword("Correct-Horse-9");

		expect(stored.startsWith("scrypt$")).toBe(true);
		expect(stored).not.toContain("Correct-Horse-9");
		expect(await verifyLocalPassword("Correct-Horse-9", stored)).toBe(true);
		expect(await verifyLocalPassword("correct-horse-9", stored)).toBe(false);
	});

	test("salts every hash so identical passwords never collide", async () => {
		const first = await hashLocalPassword("Correct-Horse-9");
		const second = await hashLocalPassword("Correct-Horse-9");

		expect(first).not.toBe(second);
		expect(await verifyLocalPassword("Correct-Horse-9", second)).toBe(true);
	});

	test("rejects malformed stored hashes instead of throwing", async () => {
		expect(await verifyLocalPassword("Correct-Horse-9", "not-a-hash")).toBe(false);
		expect(await verifyLocalPassword("Correct-Horse-9", "scrypt$$$$$")).toBe(false);
	});

	test("enforces the issued password policy", () => {
		expect(localPasswordIssue("short")).toBeTruthy();
		expect(localPasswordIssue("alllowercase123")).toBeTruthy();
		expect(localPasswordIssue("NoDigitsInHere")).toBeTruthy();
		expect(localPasswordIssue("Correct-Horse-9")).toBeNull();
	});

	test("every generated password satisfies the policy it must pass at login", () => {
		for (let index = 0; index < 25; index += 1) {
			const password = generateLocalPassword();
			expect(password).toHaveLength(20);
			expect(localPasswordIssue(password)).toBeNull();
		}
	});

	test("normalizes and validates usernames", () => {
		expect(normalizeLocalUsername("  CanBo.TruyenThong  ")).toBe(
			"canbo.truyenthong",
		);
		expect(localUsernameIssue("ab")).toBeTruthy();
		expect(localUsernameIssue("has space")).toBeTruthy();
		expect(localUsernameIssue("-leading")).toBeTruthy();
		expect(localUsernameIssue("canbo.truyen_thong-1")).toBeNull();
	});
});

describe("local session cookie", () => {
	test("seals the session token and reads it back", () => {
		const cookie = createLocalSessionCookie(localSession());

		expect(cookie).toContain(`${LOCAL_SESSION_COOKIE_NAME}=`);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).toContain("Secure");
		expect(cookie).not.toContain("local-session-token-value");

		const read = readLocalSessionCookie(
			new Request("https://cybershield.example.com", { headers: { cookie } }),
		);
		expect(read).toMatchObject({
			accountId,
			sessionId,
			username: "canbo.truyenthong",
		});
	});

	test("refuses expired and tampered cookies", () => {
		const expired = createLocalSessionCookie(
			localSession({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
		);
		expect(
			readLocalSessionCookie(
				new Request("https://cybershield.example.com", {
					headers: { cookie: expired },
				}),
			),
		).toBeNull();

		expect(
			readLocalSessionCookie(
				new Request("https://cybershield.example.com", {
					headers: { cookie: `${LOCAL_SESSION_COOKIE_NAME}=a.b.c` },
				}),
			),
		).toBeNull();
	});

	test("cannot be decrypted with a different session secret", () => {
		const cookie = createLocalSessionCookie(localSession());
		process.env.CYBERSHIELD35_SESSION_SECRET = "a-completely-different-secret";

		expect(
			readLocalSessionCookie(
				new Request("https://cybershield.example.com", { headers: { cookie } }),
			),
		).toBeNull();
	});

	test("stores only a hash of the session token", () => {
		const hash = hashLocalSessionToken("local-session-token-value-0123456789");

		expect(hash).not.toContain("local-session-token-value");
		expect(hashLocalSessionToken("local-session-token-value-0123456789")).toBe(
			hash,
		);
	});

	test("clearing expires the cookie immediately", () => {
		expect(clearLocalSessionCookie()).toContain("Max-Age=0");
	});
});

describe("proxy gating for local accounts", () => {
	test("lets a valid local session reach protected routes", async () => {
		const response = await proxy(
			new NextRequest("https://cybershield.example.com/sources", {
				headers: { cookie: createLocalSessionCookie(localSession()) },
			}),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("location")).toBeNull();
	});

	test("sends a signed-in local account away from the login page", async () => {
		const response = await proxy(
			new NextRequest("https://cybershield.example.com/login?nextUrl=/members", {
				headers: { cookie: createLocalSessionCookie(localSession()) },
			}),
		);

		expect(response.status).toBe(307);
		expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
			"/members",
		);
	});

	test("still redirects when the local cookie has expired", async () => {
		const response = await proxy(
			new NextRequest("https://cybershield.example.com/sources", {
				headers: {
					cookie: createLocalSessionCookie(
						localSession({
							expiresAt: new Date(Date.now() - 1000).toISOString(),
						}),
					),
				},
			}),
		);

		expect(response.status).toBe(307);
		expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
			"/login",
		);
	});

	test("never calls Tuturuuu for a local-only session", async () => {
		const fetchMock = mock(() =>
			Promise.reject(new Error("local sessions must not call Tuturuuu")),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await proxy(
			new NextRequest("https://cybershield.example.com/evidence", {
				headers: { cookie: createLocalSessionCookie(localSession()) },
			}),
		);

		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("session resolution", () => {
	test("validates the local cookie against the database before authorizing", async () => {
		const validateLocalSession = mock(async (cookie: LocalSessionCookie) => ({
			account: {},
			cookie,
		}));
		stubLocalAccounts({ validateLocalSession });

		const { requireAdminSession } = await import("@/lib/auth/require-admin");
		const auth = await requireAdminSession(requestWithLocalCookie());

		expect(validateLocalSession).toHaveBeenCalledTimes(1);
		if ("error" in auth) throw new Error("Expected a local session");
		expect(auth.kind).toBe("local");
		expect(auth.session.localAccount).toMatchObject({
			accountId,
			role: "member",
			sessionId,
		});
	});

	test("clears the cookie when the session row is revoked", async () => {
		stubLocalAccounts({ validateLocalSession: async () => null });

		const { requireAdminSession } = await import("@/lib/auth/require-admin");
		const auth = await requireAdminSession(requestWithLocalCookie());

		if (!("error" in auth)) throw new Error("Expected a rejected session");
		expect(auth.status).toBe(401);
		expect(auth.setCookie).toContain("Max-Age=0");
	});

	test("exposes local sessions to the client without leaking the token", async () => {
		stubLocalAccounts({
			validateLocalSession: async (cookie: LocalSessionCookie) => ({
				account: {},
				cookie: { ...cookie, mustChangePassword: true },
			}),
		});

		const { requireAdminSession } = await import("@/lib/auth/require-admin");
		const auth = await requireAdminSession(requestWithLocalCookie());
		if ("error" in auth) throw new Error("Expected a local session");

		const safe = toSafeSession(auth.session);
		expect(safe).toMatchObject({
			authenticated: true,
			kind: "local",
			mustChangePassword: true,
			user: { email: null, id: `local:${accountId}` },
		});
		expect(JSON.stringify(safe)).not.toContain("local-session-token-value");
	});

	test("marks Tuturuuu sessions distinctly", () => {
		expect(toSafeSession(tuturuuuSession()).kind).toBe("tuturuuu");
	});

	test("refuses local sessions on routes that spend the platform token", async () => {
		stubLocalAccounts();

		const { requirePlatformAdminSession } = await import(
			"@/lib/auth/require-admin"
		);
		const auth = await requirePlatformAdminSession(requestWithLocalCookie());

		if (!("error" in auth)) throw new Error("Expected a refusal");
		expect(auth.status).toBe(403);
		expect(auth.code).toBe("LOCAL_ACCOUNT_NOT_SUPPORTED");
	});
});

describe("local login route", () => {
	test("issues a session cookie and clears any stale Tuturuuu cookie", async () => {
		stubLocalAccounts();

		const { POST } = await import("@/app/api/auth/local/login/route");
		const response = await POST(
			new Request("https://cybershield.example.com/api/auth/local/login", {
				body: JSON.stringify({
					nextUrl: "/members",
					password: "Correct-Horse-9",
					username: "CanBo.TruyenThong",
				}),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			}),
		);
		const body = await response.json();
		const setCookie = response.headers.getSetCookie().join("\n");

		expect(response.status).toBe(200);
		expect(body.redirectTo).toBe("/members");
		expect(setCookie).toContain(`${LOCAL_SESSION_COOKIE_NAME}=`);
		expect(setCookie).toContain("cybershield35_admin_session=; Max-Age=0");
		expect(setCookie).not.toContain("Correct-Horse-9");
	});

	test("returns the account error status without echoing the password", async () => {
		stubLocalAccounts({
			authenticateLocalAccount: async () => {
				throw new StubLocalAccountError(
					"Tên đăng nhập hoặc mật khẩu không đúng.",
					401,
				);
			},
		});

		const { POST } = await import("@/app/api/auth/local/login/route");
		const response = await POST(
			new Request("https://cybershield.example.com/api/auth/local/login", {
				body: JSON.stringify({
					password: "Wrong-Password-9",
					username: "canbo.truyenthong",
				}),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			}),
		);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body.error).toBe("Tên đăng nhập hoặc mật khẩu không đúng.");
		expect(response.headers.get("set-cookie")).toBeNull();
		expect(JSON.stringify(body)).not.toContain("Wrong-Password-9");
	});

	test("rejects a malformed payload before touching the account store", async () => {
		const authenticateLocalAccount = mock(async () => localSession());
		stubLocalAccounts({ authenticateLocalAccount });

		const { POST } = await import("@/app/api/auth/local/login/route");
		const response = await POST(
			new Request("https://cybershield.example.com/api/auth/local/login", {
				body: JSON.stringify({ username: "canbo.truyenthong" }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			}),
		);

		expect(response.status).toBe(400);
		expect(authenticateLocalAccount).not.toHaveBeenCalled();
	});
});

describe("local account administration", () => {
	test("only a Tuturuuu workspace member-manager may manage password accounts", async () => {
		mock.module("@/lib/workspace-members/proxy", () => ({
			fetchWorkspaceMembersForRequest: async () => ({
				context: { canManageMembers: true },
			}),
		}));
		mock.module("@/lib/auth/require-admin", () => ({
			requirePlatformAdminSession: async () => ({
				kind: "live",
				session: tuturuuuSession(),
				setCookie: null,
			}),
		}));

		const { requireLocalAccountAdmin } = await import(
			"@/lib/local-accounts/admin-guard"
		);
		const guard = await requireLocalAccountAdmin(
			new Request("https://cybershield.example.com/api/admin/local-accounts"),
		);

		if (!guard.authorized) throw new Error("Expected an authorized admin");
		expect(guard.actor).toMatchObject({ id: "user-1" });
	});

	test("refuses a Tuturuuu member without member-management rights", async () => {
		mock.module("@/lib/workspace-members/proxy", () => ({
			fetchWorkspaceMembersForRequest: async () => ({
				context: { canManageMembers: false },
			}),
		}));
		mock.module("@/lib/auth/require-admin", () => ({
			requirePlatformAdminSession: async () => ({
				kind: "live",
				session: tuturuuuSession(),
				setCookie: null,
			}),
		}));

		const { requireLocalAccountAdmin } = await import(
			"@/lib/local-accounts/admin-guard"
		);
		const guard = await requireLocalAccountAdmin(
			new Request("https://cybershield.example.com/api/admin/local-accounts"),
		);

		expect(guard).toMatchObject({ authorized: false, status: 403 });
	});

	test("a password account can never manage other password accounts", async () => {
		const fetchWorkspaceMembersForRequest = mock(async () => ({
			context: { canManageMembers: true },
		}));
		mock.module("@/lib/workspace-members/proxy", () => ({
			fetchWorkspaceMembersForRequest,
		}));
		mock.module("@/lib/auth/require-admin", () => ({
			requirePlatformAdminSession: async () => ({
				code: "LOCAL_ACCOUNT_NOT_SUPPORTED",
				error: "Tính năng này cần đăng nhập bằng tài khoản Tuturuuu.",
				status: 403,
			}),
		}));

		const { requireLocalAccountAdmin } = await import(
			"@/lib/local-accounts/admin-guard"
		);
		const guard = await requireLocalAccountAdmin(requestWithLocalCookie());

		expect(guard).toMatchObject({ authorized: false, status: 403 });
		expect(fetchWorkspaceMembersForRequest).not.toHaveBeenCalled();
	});

	test("treats an unverifiable workspace as unauthorized rather than allowed", async () => {
		mock.module("@/lib/workspace-members/proxy", () => ({
			fetchWorkspaceMembersForRequest: async () => {
				throw new Error("Tuturuuu unreachable");
			},
		}));
		mock.module("@/lib/auth/require-admin", () => ({
			requirePlatformAdminSession: async () => ({
				kind: "live",
				session: tuturuuuSession(),
				setCookie: null,
			}),
		}));

		const { requireLocalAccountAdmin } = await import(
			"@/lib/local-accounts/admin-guard"
		);
		const guard = await requireLocalAccountAdmin(
			new Request("https://cybershield.example.com/api/admin/local-accounts"),
		);

		expect(guard).toMatchObject({ authorized: false, status: 503 });
	});
});

describe("local account surfaces", () => {
	test("the login screen offers password login without becoming a client component", () => {
		const screen = readFileSync(
			"components/auth/centralized-login-screen.tsx",
			"utf8",
		);
		const form = readFileSync(
			"components/auth/local-password-login-form.tsx",
			"utf8",
		);

		expect(screen).toContain("LocalPasswordLoginForm");
		expect(screen).not.toContain('"use client"');
		expect(screen).not.toContain("<input");
		expect(form).toContain('"use client"');
		expect(form).toContain('fetch("/api/auth/local/login"');
		expect(form).toContain('autoComplete="current-password"');
		expect(form).toContain("window.location.assign");
	});

	test("the members page owns password account management", () => {
		const membersPage = readFileSync(
			"components/dashboard/workspace-members-page.tsx",
			"utf8",
		);
		const panel = readFileSync(
			"components/dashboard/local-accounts-panel.tsx",
			"utf8",
		);

		expect(membersPage).toContain("<LocalAccountsPanel");
		expect(panel).toContain("/api/admin/local-accounts");
		expect(panel).toContain("localAccountsQueryOptions");
		expect(panel).toContain("Không có quyền quản lý");
		expect(panel).toContain("Đặt lại mật khẩu");
		expect(panel).toContain("Thu hồi phiên");
	});

	test("the top bar links to the public repository", () => {
		const shell = readFileSync("components/dashboard/shell.tsx", "utf8");

		expect(shell).toContain(
			'export const GITHUB_REPOSITORY_URL = "https://github.com/tutur3u/cybershield35"',
		);
		expect(shell).toContain("href={GITHUB_REPOSITORY_URL}");
		expect(shell).toContain('aria-label="Mở mã nguồn trên GitHub"');
		expect(shell).toContain('rel="noreferrer noopener"');
		expect(shell).toContain('target="_blank"');
	});

	test("logout tears down both credential cookies", () => {
		const route = readFileSync("app/api/auth/logout/route.ts", "utf8");

		expect(route).toContain("clearSessionCookie()");
		expect(route).toContain("clearLocalSessionCookie()");
		expect(route).toContain("revokeLocalSession");
	});
});
