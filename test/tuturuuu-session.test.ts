import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import {
	requireAdminSession,
	requireLocalAdminSession,
} from "@/lib/auth/require-admin";
import {
	allowLocalAuthBypass,
	createSessionCookie,
	getRequestedScopes,
	getTuturuuuAuthDiagnostics,
	isTuturuuuAuthConfigured,
	readAdminSession,
	refreshAdminSession,
	sessionNeedsIdentityRefresh,
	sessionNeedsScopeRefresh,
	toSafeSession,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";
import {
	buildManagedSchedulerApprovalUrl,
	buildTuturuuuScopeApprovalUrl,
} from "@/lib/auth/scope-approval";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function session(): TuturuuuAdminSession {
	return {
		accessToken: "ttr_app_access_secret",
		app: { name: "cybershield35" },
		createdAt: "2026-06-13T00:00:00.000Z",
		expiresAt: new Date(Date.now() + 60_000).toISOString(),
		expiresIn: 60,
		identityRefreshedAt: "2026-06-13T00:01:00.000Z",
		refreshEarlySeconds: 10,
		refreshExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
		refreshExpiresIn: 3600,
		refreshToken: "ttr_app_refresh_secret",
		scopes: getRequestedScopes(),
		tokenType: "Bearer",
		user: {
			avatarUrl: "https://example.com/admin.png",
			displayName: "Admin Example",
			email: "admin@example.com",
			id: "user-1",
		},
		workspaceId: "workspace-1",
	};
}

beforeEach(() => {
	process.env.CYBERSHIELD35_SESSION_SECRET =
		"test-secret-for-cybershield35-session-cookie";
});

afterEach(() => {
	process.env = { ...originalEnv };
	globalThis.fetch = originalFetch;
	mock.restore();
});

describe("Tuturuuu encrypted admin session", () => {
	test("stores session tokens in an encrypted HttpOnly cookie", async () => {
		const cookie = createSessionCookie(session());
		expect(cookie).toContain("HttpOnly");
		expect(cookie).not.toContain("ttr_app_access_secret");
		expect(cookie).not.toContain("ttr_app_refresh_secret");

		const request = new Request("http://localhost", {
			headers: { cookie },
		});
		const restored = await readAdminSession(request);
		expect(restored?.accessToken).toBe("ttr_app_access_secret");
		expect(restored?.refreshToken).toBe("ttr_app_refresh_secret");
		expect(restored?.identityRefreshedAt).toBe(session().identityRefreshedAt);
	});

	test("safe session strips bearer and refresh tokens", () => {
		const safe = toSafeSession(session());
		expect(JSON.stringify(safe)).not.toContain("ttr_app_access_secret");
		expect(JSON.stringify(safe)).not.toContain("ttr_app_refresh_secret");
		expect(JSON.stringify(safe)).not.toContain("workspace-1");
		expect(safe.user.avatarUrl).toBe("https://example.com/admin.png");
		expect(safe.user.displayName).toBe("Admin Example");
		expect(safe.user.email).toBe("admin@example.com");
	});

	test("old sessions with missing identity fields request one server-side refresh", () => {
		const staleSession = session();
		delete staleSession.identityRefreshedAt;
		staleSession.user = {
			email: "admin@example.com",
			id: "user-1",
		};

		expect(sessionNeedsIdentityRefresh(staleSession)).toBe(true);

		staleSession.identityRefreshedAt = "2026-06-13T00:00:00.000Z";
		expect(sessionNeedsIdentityRefresh(staleSession)).toBe(false);
	});

	test("sessions missing code-owned scopes request a server-side refresh", () => {
		const staleSession = session();
		staleSession.scopes = ["workspace:session"];

		expect(sessionNeedsScopeRefresh(staleSession)).toBe(true);

		staleSession.scopes = getRequestedScopes();
		expect(sessionNeedsScopeRefresh(staleSession)).toBe(false);
	});

	test("auth configuration requires Tuturuuu production credentials", () => {
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "secret";
		expect(isTuturuuuAuthConfigured()).toBe(true);
	});

	test("requests the code-owned workspace and profile scopes", () => {
		process.env.CYBERSHIELD35_REQUESTED_SCOPES =
			"external-projects:*,workspace:session";

		expect(getRequestedScopes()).toEqual([
			"workspace:session",
			"workspace:members:read",
			"workspace:members:write",
			"workspace:roles:read",
			"workspace:roles:write",
			"workspace:cron:read",
			"workspace:cron:write",
			"users:profile:read",
			"users:profile:write",
		]);
	});

	test("builds a Tuturuuu external-app scope approval URL without secrets", () => {
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "do-not-leak";
		process.env.TUTURUUU_WEB_APP_URL = "https://tuturuuu.com";

		const href = buildTuturuuuScopeApprovalUrl({
			appBaseUrl: "https://cybershield.example.com",
			nextUrl: "/sources?tab=facebook",
		});

		expect(href).toBeTruthy();
		const approvalUrl = new URL(href ?? "");
		expect(approvalUrl.origin).toBe("https://tuturuuu.com");
		expect(approvalUrl.pathname).toBe(
			"/vi/internal/infrastructure/external-apps/approve",
		);
		expect(approvalUrl.searchParams.get("appId")).toBe("cybershield35");
		expect(approvalUrl.searchParams.getAll("scope")).toEqual([
			"workspace:session",
			"workspace:members:read",
			"workspace:members:write",
			"workspace:roles:read",
			"workspace:roles:write",
			"workspace:cron:read",
			"workspace:cron:write",
			"users:profile:read",
			"users:profile:write",
		]);

		const returnUrl = new URL(approvalUrl.searchParams.get("returnUrl") ?? "");
		expect(returnUrl.origin).toBe("https://tuturuuu.com");
		expect(returnUrl.pathname).toBe("/login");
		const verifyUrl = new URL(returnUrl.searchParams.get("returnUrl") ?? "");
		expect(verifyUrl.origin).toBe("https://cybershield.example.com");
		expect(verifyUrl.pathname).toBe("/verify-token");
		expect(verifyUrl.searchParams.get("nextUrl")).toBe("/sources?tab=facebook");
		expect(href).not.toContain("do-not-leak");
	});

	test("builds a managed scheduler approval URL without generated tokens", () => {
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "do-not-leak";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.TUTURUUU_WEB_APP_URL = "https://tuturuuu.com";

		const href = buildManagedSchedulerApprovalUrl({
			appBaseUrl: "https://cybershield.example.com",
			origin: "https://cybershield.example.com",
		});

		expect(href).toBeTruthy();
		const approvalUrl = new URL(href ?? "");
		expect(approvalUrl.searchParams.get("feature")).toBe("managed-cron");
		expect(approvalUrl.searchParams.get("workspaceId")).toBe("workspace-1");
		expect(approvalUrl.searchParams.get("origin")).toBe(
			"https://cybershield.example.com",
		);
		expect(approvalUrl.searchParams.getAll("scope")).toContain(
			"workspace:cron:read",
		);
		expect(approvalUrl.searchParams.getAll("scope")).toContain(
			"workspace:cron:write",
		);
		expect(approvalUrl.toString()).not.toContain("do-not-leak");
		expect(approvalUrl.toString()).not.toContain("token=");

		const returnUrl = new URL(approvalUrl.searchParams.get("returnUrl") ?? "");
		expect(returnUrl.origin).toBe("https://cybershield.example.com");
		expect(returnUrl.pathname).toBe("/settings");
		expect(returnUrl.searchParams.get("cronSetup")).toBe("retry");
	});

	test("allows operators to override the Tuturuuu approval page URL", () => {
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.TUTURUUU_EXTERNAL_APP_APPROVAL_URL =
			"https://platform.example.com/en/internal/infrastructure/external-apps/approve";

		const href = buildTuturuuuScopeApprovalUrl({
			appBaseUrl: "https://cybershield.example.com",
			nextUrl: "/",
		});

		const approvalUrl = new URL(href ?? "");
		expect(approvalUrl.origin).toBe("https://platform.example.com");
		expect(approvalUrl.pathname).toBe(
			"/en/internal/infrastructure/external-apps/approve",
		);
		expect(approvalUrl.searchParams.get("appId")).toBe("cybershield35");
	});

	test("auth configuration does not require a dedicated session secret", () => {
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret-fallback";
		delete process.env.CYBERSHIELD35_SESSION_SECRET;

		expect(isTuturuuuAuthConfigured()).toBe(true);
	});

	test("reports missing auth keys by name", () => {
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		delete process.env.CYBERSHIELD35_APP_SECRET;

		const diagnostics = getTuturuuuAuthDiagnostics();

		expect(diagnostics.configured).toBe(false);
		expect(diagnostics.required).toContainEqual(
			expect.objectContaining({
				name: "CYBERSHIELD35_APP_SECRET",
				status: "missing",
			}),
		);
	});

	test("reports a malformed Tuturuuu API base URL as invalid", () => {
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret-fallback";

		const diagnostics = getTuturuuuAuthDiagnostics();

		expect(diagnostics.configured).toBe(false);
		expect(diagnostics.required).toContainEqual(
			expect.objectContaining({
				name: "TUTURUUU_API_BASE_URL",
				status: "invalid",
			}),
		);
		expect(isTuturuuuAuthConfigured()).toBe(false);
	});

	test("falls back to the app secret for encrypted session cookies", async () => {
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret-fallback";
		delete process.env.CYBERSHIELD35_SESSION_SECRET;

		const cookie = createSessionCookie(session());
		const request = new Request("http://localhost", {
			headers: { cookie },
		});

		const restored = await readAdminSession(request);
		expect(restored?.accessToken).toBe("ttr_app_access_secret");
		expect(restored?.refreshToken).toBe("ttr_app_refresh_secret");
	});

	test("local auth bypass only works outside production on localhost", () => {
		process.env.AUTH_LOCAL_BYPASS = "true";
		process.env.NODE_ENV = "development";

		expect(allowLocalAuthBypass(new Request("http://localhost:3000"))).toBe(
			true,
		);
		expect(allowLocalAuthBypass(new Request("http://127.0.0.1:3000"))).toBe(
			true,
		);
		expect(allowLocalAuthBypass(new Request("http://0.0.0.0:3000"))).toBe(true);
		expect(allowLocalAuthBypass(new Request("http://[::1]:3000"))).toBe(true);
		expect(allowLocalAuthBypass(new Request("http://app.example.com"))).toBe(
			false,
		);

		process.env.NODE_ENV = "production";
		expect(allowLocalAuthBypass(new Request("http://localhost:3000"))).toBe(
			false,
		);
	});

	test("local auth bypass is explicit", () => {
		process.env.NODE_ENV = "development";
		delete process.env.AUTH_LOCAL_BYPASS;

		expect(allowLocalAuthBypass(new Request("http://localhost:3000"))).toBe(
			false,
		);
	});

	test("local auth bypass creates a local session only for dev localhost requests", async () => {
		process.env.AUTH_LOCAL_BYPASS = "true";
		process.env.NODE_ENV = "development";

		const local = await requireAdminSession(
			new Request("http://localhost:3000"),
		);
		expect(local).toMatchObject({
			kind: "live",
			session: { user: { id: "local-dev" }, workspaceId: "local-dev" },
		});

		process.env.NODE_ENV = "production";
		const production = await requireAdminSession(
			new Request("http://localhost:3000"),
		);
		expect(production).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	test("local authorization never exchanges a near-expiry access token", async () => {
		const staleAccessSession = session();
		staleAccessSession.expiresAt = new Date(Date.now() - 60_000).toISOString();
		const fetchMock = mock(() =>
			Promise.reject(new Error("local authorization must not call Tuturuuu")),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const auth = await requireLocalAdminSession(
			new Request("https://cybershield.example.com/api/scans", {
				headers: { cookie: createSessionCookie(staleAccessSession) },
			}),
		);

		expect(auth).toMatchObject({
			kind: "live",
			setCookie: null,
			session: { accessToken: "ttr_app_access_secret" },
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("local authorization rejects incomplete scopes without an exchange", async () => {
		const incompleteSession = session();
		incompleteSession.scopes = ["workspace:session"];
		const fetchMock = mock(() =>
			Promise.reject(new Error("local authorization must not call Tuturuuu")),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const auth = await requireLocalAdminSession(
			new Request("https://cybershield.example.com/api/scans", {
				headers: { cookie: createSessionCookie(incompleteSession) },
			}),
		);

		expect(auth).toEqual({
			error: "Requested scope is not allowed for this app",
			status: 403,
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("coalesces concurrent refreshes for the same encrypted session", async () => {
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		const fetchMock = mock(async () => {
			await Promise.resolve();
			const refreshed = session();
			return Response.json({
				...refreshed,
				accessToken: "coalesced-access-token",
				refreshToken: "coalesced-refresh-token",
			});
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const current = session();
		const refreshed = await Promise.all([
			refreshAdminSession(current),
			refreshAdminSession(current),
			refreshAdminSession(current),
		]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(refreshed.map((item) => item.accessToken)).toEqual([
			"coalesced-access-token",
			"coalesced-access-token",
			"coalesced-access-token",
		]);
	});
});
