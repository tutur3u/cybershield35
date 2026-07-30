import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { POST as pendingInvitationDecision } from "@/app/api/auth/pending-invitation/route";
import { POST as verifyAppToken } from "@/app/api/auth/verify-app-token/route";
import { AuthRequiredScreen } from "@/components/dashboard/auth-required-screen";
import { resolveDashboardAuthFromRequest } from "@/lib/auth/dashboard-auth";
import {
	createPendingInvitationCookie,
	createSessionCookie,
	getRequestedScopes,
	getTuturuuuAuthDiagnostics,
	readAdminSession,
	readPendingInvitation,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";
import { proxy } from "@/proxy";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function session(): TuturuuuAdminSession {
	return {
		accessToken: "access-token",
		app: { name: "cybershield35" },
		createdAt: "2026-06-13T00:00:00.000Z",
		expiresAt: new Date(Date.now() + 60_000).toISOString(),
		expiresIn: 60,
		refreshEarlySeconds: 10,
		refreshExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
		refreshExpiresIn: 3600,
		refreshToken: "refresh-token",
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

function exchangeBody() {
	return {
		...session(),
		accessToken: "new-access-token",
		expiresAt: new Date(Date.now() + 120_000).toISOString(),
		refreshToken: "new-refresh-token",
	};
}

function pageFiles(dir = "app"): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) return pageFiles(path);
		return entry === "page.tsx" ? [path] : [];
	});
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

describe("dashboard auth gate", () => {
	test("rejects unauthenticated production requests even when bypass env is true", async () => {
		process.env.AUTH_LOCAL_BYPASS = "true";
		process.env.NODE_ENV = "production";

		const auth = await resolveDashboardAuthFromRequest(
			new Request("https://cybershield.example.com"),
		);

		expect(auth).toMatchObject({
			authenticated: false,
			error: "Authentication required",
			status: 401,
		});
	});

	test("does not allow localhost dev access unless bypass is explicit", async () => {
		process.env.NODE_ENV = "development";
		delete process.env.AUTH_LOCAL_BYPASS;

		const auth = await resolveDashboardAuthFromRequest(
			new Request("http://localhost:3000"),
		);

		expect(auth).toMatchObject({
			authenticated: false,
			error: "Authentication required",
			status: 401,
		});
	});

	test("returns auth environment diagnostics for blocked requests", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		delete process.env.CYBERSHIELD35_APP_SECRET;

		const auth = await resolveDashboardAuthFromRequest(
			new Request("https://cybershield.example.com"),
		);

		expect(auth).toMatchObject({
			authenticated: false,
			configured: false,
			error: "Authentication required",
		});

		if (auth.authenticated) throw new Error("Expected blocked request");
		expect(auth.authDiagnostics.required).toContainEqual(
			expect.objectContaining({
				name: "CYBERSHIELD35_APP_SECRET",
				status: "missing",
			}),
		);
	});

	test("returns a centralized Tuturuuu login href for configured blocked requests", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		process.env.TUTURUUU_WEB_APP_URL = "https://tuturuuu.com";

		const auth = await resolveDashboardAuthFromRequest(
			new Request("https://cybershield.example.com/sources?tab=facebook"),
		);

		if (auth.authenticated) throw new Error("Expected blocked request");
		expect(auth.configured).toBe(true);
		expect(auth.loginHref).toBeTruthy();

		const loginUrl = new URL(auth.loginHref ?? "");
		expect(loginUrl.origin).toBe("https://tuturuuu.com");
		expect(loginUrl.pathname).toBe("/login");

		const returnUrl = new URL(loginUrl.searchParams.get("returnUrl") ?? "");
		expect(returnUrl.origin).toBe("https://cybershield.example.com");
		expect(returnUrl.pathname).toBe("/verify-token");
		expect(returnUrl.searchParams.get("nextUrl")).toBe("/sources?tab=facebook");
	});

	test("allows the verify-token callback route to render before authentication", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";

		const auth = await resolveDashboardAuthFromRequest(
			new Request("https://cybershield.example.com/verify-token?token=short"),
		);

		expect(auth).toMatchObject({
			authenticated: false,
			publicRoute: true,
			status: 200,
		});
	});

	test("verify-token route returns scope approval href for scope-denied exchanges", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		process.env.TUTURUUU_WEB_APP_URL = "https://tuturuuu.com";
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (() =>
			Promise.resolve(
				Response.json(
					{ error: "Requested scope is not allowed for this app" },
					{ status: 403 },
				),
			)) as typeof fetch;

		try {
			const response = await verifyAppToken(
				new Request("https://cybershield.example.com/api/auth/verify-app-token", {
					body: JSON.stringify({ nextUrl: "/sources", token: "short" }),
					headers: { "Content-Type": "application/json" },
					method: "POST",
				}),
			);
			const body = await response.json();

			expect(response.status).toBe(403);
			expect(body.error).toBe("Requested scope is not allowed for this app");
			expect(body.scopeApprovalHref).toContain(
				"/vi/internal/infrastructure/external-apps/approve",
			);
			expect(body.scopeApprovalHref).not.toContain("app-secret");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("verify-token route stores pending invitation action in an encrypted cookie", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		process.env.TUTURUUU_WEB_APP_URL = "https://tuturuuu.com";
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (() =>
			Promise.resolve(
				Response.json(
					{
						code: "PENDING_WORKSPACE_INVITE",
						error: "Pending workspace invitation",
						invitation: {
							createdAt: "2026-07-04T00:00:00.000Z",
							role: "MEMBER",
							source: "email",
							workspaceHandle: "cs35",
							workspaceId: "workspace-1",
							workspaceName: "CS35",
						},
						invitationActionToken: "ttr_app_invitation_action_secret",
						invitationUrl: "https://tuturuuu.com/workspace-1",
						workspaceId: "workspace-1",
					},
					{ status: 403 },
				),
			)) as typeof fetch;

		try {
			const response = await verifyAppToken(
				new Request("https://cybershield.example.com/api/auth/verify-app-token", {
					body: JSON.stringify({ nextUrl: "/sources", token: "short" }),
					headers: { "Content-Type": "application/json" },
					method: "POST",
				}),
			);
			const body = await response.json();

			expect(response.status).toBe(403);
			expect(body).toMatchObject({
				code: "PENDING_WORKSPACE_INVITE",
				error: "Pending workspace invitation",
				pendingInvitation: {
					invitation: {
						workspaceId: "workspace-1",
						workspaceName: "CS35",
					},
				},
			});
			expect(body.invitationUrl).toBeUndefined();
			expect(JSON.stringify(body)).not.toContain(
				"ttr_app_invitation_action_secret",
			);
			const setCookie = response.headers.get("set-cookie") ?? "";
			expect(setCookie).toContain("cybershield35_pending_invitation=");
			expect(setCookie).toContain("HttpOnly");
			expect(setCookie).not.toContain("ttr_app_invitation_action_secret");
			const pending = await readPendingInvitation(
				new Request("https://cybershield.example.com/login", {
					headers: { cookie: setCookie },
				}),
			);
			expect(pending).toMatchObject({
				invitation: {
					workspaceId: "workspace-1",
					workspaceName: "CS35",
				},
				invitationActionToken: "ttr_app_invitation_action_secret",
				nextPath: "/sources",
				workspaceId: "workspace-1",
			});
			expect(JSON.stringify(body)).not.toContain("app-secret");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("verify-token route does not create invitation actions without a Tuturuuu action token", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		process.env.TUTURUUU_WEB_APP_URL = "https://tuturuuu.com";
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (() =>
			Promise.resolve(
				Response.json(
					{
						code: "PENDING_WORKSPACE_INVITE",
						error: "Pending workspace invitation",
						invitation: {
							workspaceId: "workspace-1",
						},
						invitationUrl: "https://tuturuuu.com/workspace-1",
					},
					{ status: 403 },
				),
			)) as typeof fetch;

		try {
			const response = await verifyAppToken(
				new Request("https://cybershield.example.com/api/auth/verify-app-token", {
					body: JSON.stringify({ nextUrl: "/sources", token: "short" }),
					headers: { "Content-Type": "application/json" },
					method: "POST",
				}),
			);
			const body = await response.json();

			expect(response.status).toBe(403);
			expect(body.code).toBe("PENDING_WORKSPACE_INVITE");
			expect(body.pendingInvitation).toBeUndefined();
			expect(response.headers.get("set-cookie")).toBeNull();
			expect(JSON.stringify(body)).not.toContain("invitation_action");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("verify-token route reports forbidden access distinctly from invalid links", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (() =>
			Promise.resolve(Response.json({ error: "Forbidden" }, { status: 403 }))) as typeof fetch;

		try {
			const response = await verifyAppToken(
				new Request("https://cybershield.example.com/api/auth/verify-app-token", {
					body: JSON.stringify({ nextUrl: "/sources", token: "short" }),
					headers: { "Content-Type": "application/json" },
					method: "POST",
				}),
			);
			const body = await response.json();

			expect(response.status).toBe(403);
			expect(body).toMatchObject({
				code: "NO_WORKSPACE_ACCESS",
				error: "Forbidden",
			});
			expect(body.scopeApprovalHref).toBeUndefined();
			expect(body.invitationUrl).toBeUndefined();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("pending invitation route accepts through Tuturuuu and creates a CS35 session", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		const pending = createPendingInvitationCookie({
			invitation: {
				workspaceId: "workspace-1",
				workspaceName: "CS35",
			},
			invitationActionToken: "ttr_app_invitation_action_secret",
			nextPath: "/sources",
			workspaceId: "workspace-1",
		}).pendingInvitation;
		const cookie = createPendingInvitationCookie({
			invitation: pending.invitation,
			invitationActionToken: pending.invitationActionToken,
			nextPath: pending.nextPath,
			workspaceId: pending.workspaceId,
		});
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (_url, init) => {
			const requestBody = JSON.parse(String(init?.body));
			expect(requestBody).toMatchObject({
				action: "accept",
				appId: "cybershield35",
				appSecret: "app-secret",
				invitationActionToken: "ttr_app_invitation_action_secret",
				workspaceId: "workspace-1",
			});
			return Response.json(session());
		}) as typeof fetch;

		try {
			const response = await pendingInvitationDecision(
				new Request("https://cybershield.example.com/api/auth/pending-invitation", {
					body: JSON.stringify({
						action: "accept",
						csrfToken: cookie.pendingInvitation.csrfToken,
					}),
					headers: {
						"Content-Type": "application/json",
						cookie: cookie.cookie,
					},
					method: "POST",
				}),
			);
			const body = await response.json();
			const setCookie = response.headers.get("set-cookie") ?? "";

			expect(response.status).toBe(200);
			expect(body).toMatchObject({
				redirectTo: "/sources",
				session: {
					authenticated: true,
				},
				status: "accepted",
			});
			expect(setCookie).toContain("cybershield35_pending_invitation=");
			expect(setCookie).toContain("cybershield35_admin_session=");
			expect(setCookie).not.toContain("ttr_app_invitation_action_secret");
			expect(setCookie).not.toContain("access-token");
			expect(setCookie).not.toContain("refresh-token");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("pending invitation route rejects through Tuturuuu and clears pending state", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		const pending = createPendingInvitationCookie({
			invitation: {
				workspaceId: "workspace-1",
				workspaceName: "CS35",
			},
			invitationActionToken: "ttr_app_invitation_action_secret",
			nextPath: "/sources",
			workspaceId: "workspace-1",
		});
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (_url, init) => {
			const requestBody = JSON.parse(String(init?.body));
			expect(requestBody.action).toBe("reject");
			return Response.json({ status: "rejected" });
		}) as typeof fetch;

		try {
			const response = await pendingInvitationDecision(
				new Request("https://cybershield.example.com/api/auth/pending-invitation", {
					body: JSON.stringify({
						action: "reject",
						csrfToken: pending.pendingInvitation.csrfToken,
					}),
					headers: {
						"Content-Type": "application/json",
						cookie: pending.cookie,
					},
					method: "POST",
				}),
			);
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body).toMatchObject({
				redirectTo: "/login?nextUrl=%2Fsources&reason=no-access",
				status: "rejected",
			});
			expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("pending invitation route clears stale Tuturuuu action tokens and returns a reload redirect", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		const pending = createPendingInvitationCookie({
			invitation: {
				workspaceId: "workspace-1",
				workspaceName: "CS35",
			},
			invitationActionToken: "ttr_app_invitation_action_secret",
			nextPath: "/sources",
			workspaceId: "workspace-1",
		});
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (() =>
			Promise.resolve(
				Response.json(
					{
						code: "INVITATION_ACTION_TOKEN_ALREADY_USED",
						error: "Invitation action token is already used",
					},
					{ status: 409 },
				),
			)) as typeof fetch;

		try {
			const response = await pendingInvitationDecision(
				new Request("https://cybershield.example.com/api/auth/pending-invitation", {
					body: JSON.stringify({
						action: "accept",
						csrfToken: pending.pendingInvitation.csrfToken,
					}),
					headers: {
						"Content-Type": "application/json",
						cookie: pending.cookie,
					},
					method: "POST",
				}),
			);
			const body = await response.json();

			expect(response.status).toBe(409);
			expect(body).toMatchObject({
				code: "INVITATION_ACTION_TOKEN_ALREADY_USED",
				error: "Invitation action token is already used",
				redirectTo: "/login?nextUrl=%2Fsources&reason=invitation",
			});
			expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
			expect(JSON.stringify(body)).not.toContain(
				"ttr_app_invitation_action_secret",
			);
			expect(JSON.stringify(body)).not.toContain("app-secret");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("pending invitation route classifies legacy Tuturuuu already-used action token responses", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		const pending = createPendingInvitationCookie({
			invitation: {
				workspaceId: "workspace-1",
				workspaceName: "CS35",
			},
			invitationActionToken: "ttr_app_invitation_action_secret",
			nextPath: "/",
			workspaceId: "workspace-1",
		});
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (() =>
			Promise.resolve(
				Response.json(
					{
						error: "Invitation action token is expired or already used",
					},
					{ status: 409 },
				),
			)) as typeof fetch;

		try {
			const response = await pendingInvitationDecision(
				new Request("https://cybershield.example.com/api/auth/pending-invitation", {
					body: JSON.stringify({
						action: "accept",
						csrfToken: pending.pendingInvitation.csrfToken,
					}),
					headers: {
						"Content-Type": "application/json",
						cookie: pending.cookie,
					},
					method: "POST",
				}),
			);
			const body = await response.json();

			expect(response.status).toBe(409);
			expect(body).toMatchObject({
				code: "INVITATION_ACTION_TOKEN_ALREADY_USED",
				error: "Invitation action token is expired or already used",
				redirectTo: "/login?nextUrl=%2F&reason=invitation",
			});
			expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
			expect(JSON.stringify(body)).not.toContain(
				"ttr_app_invitation_action_secret",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("pending invitation route keeps retryable replay-store failures actionable", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		const pending = createPendingInvitationCookie({
			invitation: {
				workspaceId: "workspace-1",
				workspaceName: "CS35",
			},
			invitationActionToken: "ttr_app_invitation_action_secret",
			nextPath: "/sources",
			workspaceId: "workspace-1",
		});
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (() =>
			Promise.resolve(
				Response.json(
					{
						code: "INVITATION_ACTION_REPLAY_STORE_UNAVAILABLE",
						error: "Invitation replay protection is unavailable",
					},
					{ status: 503 },
				),
			)) as typeof fetch;

		try {
			const response = await pendingInvitationDecision(
				new Request("https://cybershield.example.com/api/auth/pending-invitation", {
					body: JSON.stringify({
						action: "accept",
						csrfToken: pending.pendingInvitation.csrfToken,
					}),
					headers: {
						"Content-Type": "application/json",
						cookie: pending.cookie,
					},
					method: "POST",
				}),
			);
			const body = await response.json();

			expect(response.status).toBe(503);
			expect(body).toMatchObject({
				code: "INVITATION_ACTION_REPLAY_STORE_UNAVAILABLE",
				error: "Invitation replay protection is unavailable",
				retryable: true,
			});
			expect(body.redirectTo).toBeUndefined();
			expect(response.headers.get("set-cookie")).toBeNull();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("allows the login page to render before authentication", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		process.env.TUTURUUU_WEB_APP_URL = "https://tuturuuu.com";

		const auth = await resolveDashboardAuthFromRequest(
			new Request("https://cybershield.example.com/login?nextUrl=/sources"),
		);

		expect(auth).toMatchObject({
			authenticated: false,
			publicRoute: true,
			status: 200,
		});
		if (auth.authenticated) throw new Error("Expected public login route");
		expect(auth.loginPath).toBe("/login?nextUrl=%2Fsources");

		const loginUrl = new URL(auth.loginHref ?? "");
		const returnUrl = new URL(loginUrl.searchParams.get("returnUrl") ?? "");
		expect(returnUrl.pathname).toBe("/verify-token");
		expect(returnUrl.searchParams.get("nextUrl")).toBe("/sources");
	});

	test("proxy redirects unauthenticated protected routes to /login", async () => {
		process.env.NODE_ENV = "production";

		const response = await proxy(
			new NextRequest("https://cybershield.example.com/sources?tab=facebook"),
		);

		expect(response.status).toBe(307);
		const location = new URL(response.headers.get("location") ?? "");
		expect(location.origin).toBe("https://cybershield.example.com");
		expect(location.pathname).toBe("/login");
		expect(location.searchParams.get("nextUrl")).toBe("/sources?tab=facebook");
	});

	test("proxy lets public auth routes render without a session", async () => {
		process.env.NODE_ENV = "production";

		const loginResponse = await proxy(
			new NextRequest("https://cybershield.example.com/login?nextUrl=/sources"),
		);
		const verifyResponse = await proxy(
			new NextRequest(
				"https://cybershield.example.com/verify-token?token=short",
			),
		);

		expect(loginResponse.status).toBe(200);
		expect(loginResponse.headers.get("location")).toBeNull();
		expect(verifyResponse.status).toBe(200);
		expect(verifyResponse.headers.get("location")).toBeNull();
	});

	test("proxy allows valid sessions and skips the login page for them", async () => {
		process.env.NODE_ENV = "production";
		const cookie = createSessionCookie(session());

		const protectedResponse = await proxy(
			new NextRequest("https://cybershield.example.com/sources", {
				headers: { cookie },
			}),
		);
		const loginResponse = await proxy(
			new NextRequest(
				"https://cybershield.example.com/login?nextUrl=/sources",
				{
					headers: { cookie },
				},
			),
		);

		expect(protectedResponse.status).toBe(200);
		expect(protectedResponse.headers.get("location")).toBeNull();
		expect(loginResponse.status).toBe(307);
		expect(new URL(loginResponse.headers.get("location") ?? "").pathname).toBe(
			"/sources",
		);
	});

	test("proxy sends scope-incomplete sessions to the centralized scope login state", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		const incompleteSession = session();
		incompleteSession.scopes = ["workspace:session"];
		const cookie = createSessionCookie(incompleteSession);
		const fetchMock = mock(() =>
			Promise.resolve(
				Response.json(
					{ error: "Requested scope is not allowed for this app" },
					{ status: 403 },
				),
			),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const protectedResponse = await proxy(
			new NextRequest("https://cybershield.example.com/sources", {
				headers: { cookie },
			}),
		);
		const loginResponse = await proxy(
			new NextRequest(
				"https://cybershield.example.com/login?nextUrl=/sources",
				{
					headers: { cookie },
				},
			),
		);

		expect(protectedResponse.status).toBe(307);
		const location = new URL(protectedResponse.headers.get("location") ?? "");
		expect(location.pathname).toBe("/login");
		expect(location.searchParams.get("nextUrl")).toBe("/sources");
		expect(location.searchParams.get("reason")).toBe("scope");
		expect(loginResponse.status).toBe(200);
		expect(loginResponse.headers.get("location")).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("allows explicit localhost dev bypass", async () => {
		process.env.AUTH_LOCAL_BYPASS = "true";
		process.env.NODE_ENV = "development";

		const auth = await resolveDashboardAuthFromRequest(
			new Request("http://localhost:3000"),
		);

		expect(auth).toMatchObject({
			authenticated: true,
			session: { user: { displayName: "Local Admin", id: "local-dev" } },
		});
		expect(JSON.stringify(auth)).not.toContain("workspaceId");
	});

	test("accepts a valid encrypted Tuturuuu session cookie", async () => {
		process.env.NODE_ENV = "production";
		const cookie = createSessionCookie(session());

		const auth = await resolveDashboardAuthFromRequest(
			new Request("https://cybershield.example.com", {
				headers: { cookie },
			}),
		);

		expect(auth).toMatchObject({
			authenticated: true,
			session: {
				appName: "cybershield35",
				user: {
					avatarUrl: "https://example.com/admin.png",
					displayName: "Admin Example",
					email: "admin@example.com",
					id: "user-1",
				},
			},
		});
		expect(JSON.stringify(auth)).not.toContain("access-token");
		expect(JSON.stringify(auth)).not.toContain("refresh-token");
		expect(JSON.stringify(auth)).not.toContain("workspace-1");
		expect(JSON.stringify(auth)).not.toContain("workspaceId");
	});

	test("local dashboard auth accepts stale access without a Tuturuuu exchange", async () => {
		process.env.NODE_ENV = "production";
		const staleSession = session();
		staleSession.expiresAt = new Date(Date.now() - 60_000).toISOString();
		const cookie = createSessionCookie(staleSession);
		const fetchMock = mock(() =>
			Promise.reject(new Error("local auth must not call Tuturuuu")),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const auth = await resolveDashboardAuthFromRequest(
			new Request("https://cybershield.example.com/sources?tab=facebook", {
				headers: { cookie },
			}),
		);

		expect(auth.authenticated).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("proxy refreshes once and persists the cookie for the current render", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		const staleSession = session();
		staleSession.expiresAt = new Date(Date.now() + 1000).toISOString();
		const fetchMock = mock(() => Promise.resolve(Response.json(exchangeBody())));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const response = await proxy(
			new NextRequest("https://cybershield.example.com/sources", {
				headers: { cookie: createSessionCookie(staleSession) },
			}),
		);

		expect(response.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).toContain("cybershield35_admin_session=");
		const refreshed = await readAdminSession(
			new Request("https://cybershield.example.com", {
				headers: { cookie: setCookie ?? "" },
			}),
		);
		expect(refreshed?.accessToken).toBe("new-access-token");
		expect(response.headers.get("x-middleware-request-cookie")).toContain(
			"cybershield35_admin_session=",
		);
	});

	test("proxy clears a failed refresh session before redirecting", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		const staleSession = session();
		staleSession.expiresAt = new Date(Date.now() + 1000).toISOString();
		globalThis.fetch = mock(() =>
			Promise.resolve(
				Response.json(
					{ error: "Invalid or expired refresh token" },
					{ status: 401 },
				),
			),
		) as unknown as typeof fetch;

		const response = await proxy(
			new NextRequest("https://cybershield.example.com/sources", {
				headers: { cookie: createSessionCookie(staleSession) },
			}),
		);

		expect(response.status).toBe(307);
		const location = new URL(response.headers.get("location") ?? "");
		expect(location.pathname).toBe("/login");
		expect(location.searchParams.get("reason")).toBe("expired");
		expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
	});

	test("root layout gates protected pages before rendering protected children", () => {
		const source = readFileSync("app/layout.tsx", "utf8");
		const dashboard = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);

		expect(source).toContain("resolveDashboardAuthFromCurrentRequest");
		expect(source).not.toContain("connection()");
		expect(source).toContain("DashboardAppSkeleton");
		expect(source).toContain("redirect(auth.loginPath)");
		expect(source).toContain("DashboardLayoutShell");
		expect(source).toContain("<DashboardLayoutShell");
		expect(source).toContain("auth.authenticated");
		expect(source).toContain("auth.publicRoute");
		expect(source).toContain("{children}");
		expect(source).not.toContain("LockedDashboard");
		expect(source).not.toContain("AuthRequiredScreen");
		expect(dashboard).not.toContain("<Sidebar");
		expect(dashboard).not.toContain("<TopBar");
		expect(dashboard).not.toContain("sidebarCollapsed");
	});

	test("app pages do not own the route protection boundary", () => {
		for (const file of pageFiles()) {
			const source = readFileSync(file, "utf8");
			expect(source, file).not.toContain("ProtectedDashboard");
		}
	});

	test("unauthenticated screen gives admin setup instructions instead of token entry", () => {
		const source = readFileSync(
			"components/auth/centralized-login-screen.tsx",
			"utf8",
		);
		const loginLink = readFileSync(
			"components/auth/tuturuuu-login-link.tsx",
			"utf8",
		);

		expect(source).toContain("authDiagnostics.required");
		expect(source).toContain("statusLabel");
		expect(source).toContain("Đã cấu hình");
		expect(source).toContain("Sai cấu hình");
		expect(source).toContain("Thiếu");
		expect(source).toContain("loginHref");
		expect(source).toContain("TuturuuuLoginLink");
		expect(loginLink).toContain("Đăng nhập bằng Tuturuuu");
		expect(source).toContain("AUTH_LOCAL_BYPASS");

		expect(source).not.toContain('"use client"');
		expect(source).not.toContain("useRouter");
		expect(source).not.toContain("useState");
		expect(source).not.toContain("fetch(");
		expect(source).not.toContain("Short app token");
		expect(source).not.toContain("Dán token");
		expect(source).not.toContain("Xác thực Tuturuuu");
		expect(source).not.toContain("verify-app-token");
		expect(source).not.toContain("<input");
		expect(source).not.toContain("ShieldCheck");
		expect(source).not.toContain("CyberShield 35");
	});

	test("Tuturuuu login click shows persistent loading before provider redirect", () => {
		const loginLink = readFileSync(
			"components/auth/tuturuuu-login-link.tsx",
			"utf8",
		);
		const loginScreen = readFileSync(
			"components/auth/centralized-login-screen.tsx",
			"utf8",
		);

		expect(loginScreen).toContain("<TuturuuuLoginLink href={loginHref} />");
		expect(loginLink).toContain('"use client"');
		expect(loginLink).toContain("useState(false)");
		expect(loginLink).toContain("event.preventDefault()");
		expect(loginLink).toContain("setPending(true)");
		expect(loginLink).toContain("window.requestAnimationFrame");
		expect(loginLink).toContain("window.location.assign(href)");
		expect(loginLink).toContain("aria-busy={pending}");
		expect(loginLink).toContain("Loader2");
		expect(loginLink).toContain("animate-spin");
		expect(loginLink).toContain("Đang mở Tuturuuu...");
		expect(loginLink).toContain("Đăng nhập bằng Tuturuuu");
	});

	test("configured unauthenticated screen hides admin setup diagnostics", () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		process.env.DATABASE_URL = "postgresql://example";
		process.env.LLM_API_KEY = "llm-key";
		process.env.APIFY_TOKEN = "apify-token";
		process.env.FIRECRAWL_API_KEY = "firecrawl-key";
		process.env.BROWSER_USE_API_KEY = "browser-use-key";

		const markup = renderToStaticMarkup(
			createElement(AuthRequiredScreen, {
				authDiagnostics: getTuturuuuAuthDiagnostics(),
				configured: true,
				error: "Authentication required",
				loginHref:
					"https://tuturuuu.com/login?returnUrl=https%3A%2F%2Fcybershield.example.com%2Fverify-token",
			}),
		);

		expect(markup).toContain("Đăng nhập để tiếp tục");
		expect(markup).toContain("Đăng nhập bằng Tuturuuu");
		expect(markup).toContain("/brand-icons/tuturuuu.svg");
		expect(markup).not.toContain("CyberShield 35");
		expect(markup).not.toContain("lucide-shield");
		expect(markup).not.toContain("Không có phiên quản trị hợp lệ");
		expect(markup).not.toContain("Authentication required");
		expect(markup).not.toContain("Tuturuuu Auth");
		expect(markup).not.toContain("Runtime Services");
		expect(markup).not.toContain("Local development");
		expect(markup).not.toContain("TUTURUUU_API_BASE_URL");
		expect(markup).not.toContain("DATABASE_URL");
		expect(markup).not.toContain("AUTH_LOCAL_BYPASS");
	});

	test("login route owns the customer-facing Tuturuuu login flow", () => {
		const source = readFileSync("app/login/page.tsx", "utf8");

		expect(source).toContain("AuthRequiredScreen");
		expect(source).toContain("buildTuturuuuCentralizedLoginUrl");
		expect(source).toContain("buildTuturuuuScopeApprovalUrl");
		expect(source).toContain("safeLoginReason");
		expect(source).toContain("safePostLoginPath");
		expect(source).toContain("readAdminSession");
		expect(source).toContain("sessionNeedsScopeRefresh");
		expect(source).toContain("!needsScopeApproval");
		expect(source).toContain("redirect(nextPath)");
		expect(source).not.toContain("<input");
		expect(source).not.toContain("Dán token");
		expect(source).not.toContain("Short app token");
	});

	test("session status endpoint returns the local login route", () => {
		const source = readFileSync("app/api/admin/session/route.ts", "utf8");

		expect(source).toContain("buildLocalLoginPath");
		expect(source).toContain("safePostLoginPath");
		expect(source).not.toContain("buildTuturuuuCentralizedLoginUrl");
	});

	test("misconfigured unauthenticated screen names blocking envs", () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		delete process.env.CYBERSHIELD35_APP_SECRET;
		process.env.DATABASE_URL = "postgresql://example";
		process.env.LLM_API_KEY = "llm-key";
		process.env.APIFY_TOKEN = "apify-token";
		process.env.FIRECRAWL_API_KEY = "firecrawl-key";
		process.env.BROWSER_USE_API_KEY = "browser-use-key";

		const markup = renderToStaticMarkup(
			createElement(AuthRequiredScreen, {
				authDiagnostics: getTuturuuuAuthDiagnostics(),
				configured: false,
				error: "Authentication required",
			}),
		);

		expect(markup).toContain("Cấu hình máy chủ chưa hoàn tất");
		expect(markup).toContain("CYBERSHIELD35_APP_SECRET");
		expect(markup).toContain("Thiếu");
		expect(markup).not.toContain("CYBERSHIELD35_SESSION_SECRET");
		expect(markup).not.toContain("Đăng nhập bằng Tuturuuu");
	});

	test("centralized login renders scope approval only when provided", () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		process.env.DATABASE_URL = "postgresql://example";
		process.env.LLM_API_KEY = "llm-key";
		process.env.APIFY_TOKEN = "apify-token";
		process.env.FIRECRAWL_API_KEY = "firecrawl-key";
		process.env.BROWSER_USE_API_KEY = "browser-use-key";

		const withoutApproval = renderToStaticMarkup(
			createElement(AuthRequiredScreen, {
				authDiagnostics: getTuturuuuAuthDiagnostics(),
				configured: true,
				error: "Requested scope is not allowed for this app",
				loginHref: "/login?nextUrl=%2Fsources",
			}),
		);
		expect(withoutApproval).toContain("Đăng nhập để tiếp tục");
		expect(withoutApproval).toContain("Đăng nhập bằng Tuturuuu");
		expect(withoutApproval).not.toContain("Duyệt quyền truy cập");
		expect(withoutApproval).not.toContain("CyberShield 35");
		expect(withoutApproval).not.toContain("lucide-shield");
		expect(withoutApproval).not.toContain("Đã đăng xuất");
		expect(withoutApproval).not.toContain("Phiên hiện tại đã được đóng");
		expect(withoutApproval).not.toContain("Bạn đã đăng xuất an toàn");

		const withApproval = renderToStaticMarkup(
			createElement(AuthRequiredScreen, {
				authDiagnostics: getTuturuuuAuthDiagnostics(),
				configured: true,
				error: "Requested scope is not allowed for this app",
				loginHref: "/login?nextUrl=%2Fsources",
				reason: "scope",
				scopeApprovalHref:
					"https://tuturuuu.com/vi/internal/infrastructure/external-apps/approve?appId=cybershield35",
			}),
		);
		expect(withApproval).toContain("Cần duyệt quyền truy cập");
		expect(withApproval).toContain("Đăng nhập bằng Tuturuuu");
		expect(withApproval).toContain("Duyệt quyền truy cập");
		expect(withApproval).toContain(
			"https://tuturuuu.com/vi/internal/infrastructure/external-apps/approve?appId=cybershield35",
		);

		const withInvitation = renderToStaticMarkup(
			createElement(AuthRequiredScreen, {
				authDiagnostics: getTuturuuuAuthDiagnostics(),
				configured: true,
				error: "Pending workspace invitation",
				loginHref: "/login?nextUrl=%2Fsources",
				pendingInvitationExpired: true,
				reason: "invitation",
			}),
		);
		expect(withInvitation).toContain("Cần tải lại lời mời");
		expect(withInvitation).toContain("Đăng nhập bằng Tuturuuu");
		expect(withInvitation).not.toContain("Xem lời mời Tuturuuu");
		expect(withInvitation).not.toContain("Chấp nhận lời mời");

		const pendingInvitationActions = readFileSync(
			"components/auth/pending-invitation-actions.tsx",
			"utf8",
		);
		const centralizedLoginScreen = readFileSync(
			"components/auth/centralized-login-screen.tsx",
			"utf8",
		);
		expect(centralizedLoginScreen).toContain("PendingInvitationActions");
		expect(pendingInvitationActions).toContain("/api/auth/pending-invitation");
		expect(pendingInvitationActions).toContain("isTerminalInvitationFailure");
		expect(pendingInvitationActions).toContain("router.replace(body.redirectTo)");
		expect(pendingInvitationActions).toContain("Chấp nhận lời mời");
		expect(pendingInvitationActions).toContain("Từ chối");

		const noAccess = renderToStaticMarkup(
			createElement(AuthRequiredScreen, {
				authDiagnostics: getTuturuuuAuthDiagnostics(),
				configured: true,
				error: "Forbidden",
				loginHref: "/login?nextUrl=%2Fsources",
				reason: "no-access",
			}),
		);
		expect(noAccess).toContain("Không có quyền truy cập");
		expect(noAccess).toContain("chưa được cấp quyền truy cập");
		expect(noAccess).toContain("Đăng nhập bằng Tuturuuu");
		expect(noAccess).not.toContain("Liên kết đăng nhập không hợp lệ");
	});

	test("dashboard UI does not expose a browser token paste flow", () => {
		for (const file of [
			"components/dashboard/cybershield-dashboard.tsx",
			"components/dashboard/dashboard-pages.tsx",
			"components/dashboard/dialogs.tsx",
			"components/dashboard/page-widgets.tsx",
			"components/dashboard/client-actions.ts",
		]) {
			const source = readFileSync(file, "utf8");
			expect(source, file).not.toContain("AuthDialog");
			expect(source, file).not.toContain("onOpenAuth");
			expect(source, file).not.toContain("onSessionVerified");
			expect(source, file).not.toContain("Short app token");
			expect(source, file).not.toContain("Dán token");
			expect(source, file).not.toContain("Xác thực Tuturuuu");
			expect(source, file).not.toContain("verify-app-token");
			expect(source, file).not.toContain("Quản lý phiên");
		}
	});

	test("account dropdown owns auth actions and theme controls", () => {
		const shell = readFileSync("components/dashboard/shell.tsx", "utf8");
		const pages = readFileSync(
			"components/dashboard/dashboard-pages.tsx",
			"utf8",
		);
		const widgets = readFileSync(
			"components/dashboard/page-widgets.tsx",
			"utf8",
		);

		expect(shell).toContain("function AccountMenu");
		expect(shell).toContain("@tuturuuu/ui/dropdown-menu");
		expect(shell).toContain("@tuturuuu/ui/avatar");
		expect(shell).toContain("DropdownMenuSub");
		expect(shell).toContain("DropdownMenuRadioGroup");
		expect(shell).toContain("AccountAvatar");
		expect(shell).toContain("AvatarImage");
		expect(shell).toContain("onLogout");
		expect(shell).toContain("onSelectTheme");
		expect(shell).toContain("themeLabel");
		expect(shell).toContain("avatarUrl");
		expect(shell).toContain("displayName");
		expect(shell).toContain("email");
		expect(shell).toContain("focus-visible:ring-0");
		expect(shell).not.toContain("onRefreshAuth");
		expect(shell).not.toContain("Làm mới phiên");
		expect(shell).not.toContain("TuturuuLogo");
		expect(shell).not.toContain("workspaceId");
		expect(shell).not.toContain("Workspace đã liên kết");
		expect(shell).not.toContain("ThemeToggleButton");
		expect(pages).not.toContain("AuthSummary");
		expect(widgets).not.toContain("AuthSummary");
		expect(widgets).not.toContain("Tuturuuu server auth");
	});

	test("dashboard chrome removes legacy status copy and supports collapsing the sidebar", () => {
		const shell = readFileSync("components/dashboard/shell.tsx", "utf8");
		const layoutShell = readFileSync(
			"components/dashboard/dashboard-layout-shell.tsx",
			"utf8",
		);
		const data = readFileSync(
			"components/dashboard/dashboard-data.ts",
			"utf8",
		);

		expect(shell).not.toContain("Admin Control");
		expect(shell).not.toContain("topBarItems");
		expect(data).not.toContain("Hệ thống hoạt động");
		expect(layoutShell).toContain("sidebarCollapsed");
		expect(shell).toContain("PanelLeftClose");
		expect(shell).toContain("PanelLeftOpen");
		expect(shell).toContain("aria-label={collapsed ? \"Mở rộng sidebar\" : \"Thu gọn sidebar\"}");
	});

	test("collapsed sidebar navigation uses native accessible labels", () => {
		const shell = readFileSync("components/dashboard/shell.tsx", "utf8");
		const layoutShell = readFileSync(
			"components/dashboard/dashboard-layout-shell.tsx",
			"utf8",
		);

		expect(shell).not.toContain("@tuturuuu/ui/tooltip");
		expect(shell).not.toContain("TooltipProvider");
		expect(shell).not.toContain("TooltipTrigger");
		expect(shell).not.toContain("TooltipContent");
		expect(shell).toContain("aria-label={collapsed ? item.label : undefined}");
		expect(shell).toContain("collapsed ? item.label : undefined");
		expect(shell).toContain("items-center justify-start");
		expect(shell).toContain("lg:justify-start lg:gap-3 lg:px-3");
		expect(shell).not.toContain("lg:justify-center lg:px-0");
		expect(shell).toContain('className="shrink-0"');
		expect(layoutShell).toContain("<Sidebar");
		expect(layoutShell).toContain("<TopBar");
	});

	test("mobile sidebar behaves as a dismissible drawer", () => {
		const shell = readFileSync("components/dashboard/shell.tsx", "utf8");

		expect(shell).toContain('aria-label="Thanh điều hướng"');
		expect(shell).toContain('aria-label="Đóng điều hướng"');
		expect(shell).toContain('event.key === "Escape"');
		expect(shell).toContain('document.body.style.overflow = "hidden"');
		expect(shell).toContain("manuallyCollapsedActivePath");
		expect(shell).toContain("routeRevealsSection");
		expect(shell).not.toContain("section.id === activeSection ||");
	});

	test("sidebar uses the CyberShield35 wordmark as the home link", () => {
		const shell = readFileSync("components/dashboard/shell.tsx", "utf8");

		expect(shell).toContain("CyberShield35");
		expect(shell).toContain("BrandmarkLink");
		expect(shell).toContain("<span>CyberShield35</span>");
		expect(shell).not.toContain('import "slot-text/style.css"');
		expect(shell).not.toContain('import { SlotText } from "slot-text/react"');
		expect(shell).not.toContain("<SlotText");
		expect(shell).toContain("leading-[1.35]");
		expect(shell).toContain('href="/"');
		expect(shell).toContain('aria-label="CyberShield35"');
		expect(shell).not.toContain('active={pathname === "/"}');
		expect(shell).toContain("collapsed ? \"hidden lg:hidden\" :");
		expect(shell).not.toContain("transition-[max-width,opacity]");
		expect(shell).not.toContain("bg-[linear-gradient");
		expect(shell).not.toContain("[background-image:");
		expect(shell).not.toContain("shadow-[0_0_18px");
		expect(shell).not.toContain("ShieldCheck");
		expect(shell).not.toContain("CyberShield 35");
	});

	test("profile editing lives in the account menu dialog", () => {
		const shell = readFileSync("components/dashboard/shell.tsx", "utf8");
		const layoutShell = readFileSync(
			"components/dashboard/dashboard-layout-shell.tsx",
			"utf8",
		);
		const dashboard = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);
		const pages = readFileSync(
			"components/dashboard/dashboard-pages.tsx",
			"utf8",
		);

		expect(shell).toContain("onOpenProfile");
		expect(shell).toContain("Hồ sơ tài khoản");
		expect(layoutShell).toContain("profileDialogOpen");
		expect(layoutShell).toContain("ProfileSettingsPanel");
		expect(layoutShell).toContain("setProfileDialogOpen(true)");
		expect(layoutShell).toContain("currentLoginHref");
		expect(layoutShell).toContain("nextUrl");
		expect(dashboard).not.toContain("profileDialogOpen");
		expect(dashboard).not.toContain("ProfileSettingsPanel");
		expect(pages).not.toContain("ProfileSettingsPanel");
	});

	test("authenticated dashboard copy does not mention Tuturuuu by name", () => {
		for (const file of [
			"components/dashboard/client-actions.ts",
			"components/dashboard/cybershield-dashboard.tsx",
			"components/dashboard/dashboard-pages.tsx",
			"components/dashboard/profile-settings-panel.tsx",
			"components/dashboard/shell.tsx",
			"components/dashboard/workspace-members-page.tsx",
		]) {
			const source = readFileSync(file, "utf8");
			expect(source, file).not.toContain("Hồ sơ Tuturuuu");
			expect(source, file).not.toContain("Tài khoản Tuturuuu");
			expect(source, file).not.toContain("Phiên Tuturuuu");
			expect(source, file).not.toContain("Tuturuuu external app");
			expect(source, file).not.toContain("Duyệt quyền trong Tuturuuu");
			expect(source, file).not.toContain("Tuturuuu Storage");
		}
	});

	test("account dropdown owns server settings and notification empty state", () => {
		const shell = readFileSync("components/dashboard/shell.tsx", "utf8");
		const layoutShell = readFileSync(
			"components/dashboard/dashboard-layout-shell.tsx",
			"utf8",
		);
		const dashboard = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);
		const pages = readFileSync(
			"components/dashboard/dashboard-pages.tsx",
			"utf8",
		);
		const data = readFileSync(
			"components/dashboard/dashboard-data.ts",
			"utf8",
		);

		expect(shell).toContain("onOpenSettings");
		expect(shell).toContain("Cấu hình máy chủ");
		expect(shell).toContain("Không có thông báo mới");
		expect(layoutShell).toContain("settingsDialogOpen");
		expect(layoutShell).toContain("<ProviderStatus");
		expect(dashboard).not.toContain("settingsDialogOpen");
		expect(dashboard).not.toContain("<ProviderStatus");
		expect(pages).not.toContain("<ProviderStatus");
		expect(data).not.toContain('href: "/settings"');
	});

	test("profile editor uploads avatar files through the Cybershield proxy instead of accepting media links", () => {
		const panel = readFileSync(
			"components/dashboard/profile-settings-panel.tsx",
			"utf8",
		);
		const route = readFileSync(
			"app/api/auth/profile/avatar/upload-url/route.ts",
			"utf8",
		);

		expect(panel).toContain("uploadAvatarFile");
		expect(panel).toContain('type="file"');
		expect(panel).toContain("/api/auth/profile/avatar/upload-url");
		expect(panel).toContain('accept="image/png,image/jpeg,image/gif,image/webp"');
		expect(panel).not.toContain("Avatar URL");
		expect(panel).not.toContain('type="url"');
		expect(panel).not.toContain("https://example.com/avatar.png");
		expect(route).toContain('buildTuturuuuApiUrl("users/me/avatar/upload-url")');
		expect(route).toContain("fetchTuturuuuWithBearer");
		expect(route).not.toContain("CYBERSHIELD35_APP_SECRET");
	});

	test("dashboard exposes CRUD actions for scans, evidence, tracked sources, and report presets", () => {
		const dashboard = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);
		const pages = readFileSync(
			"components/dashboard/dashboard-pages.tsx",
			"utf8",
		);
		const sourcesPage = readFileSync(
			"components/dashboard/sources-page.tsx",
			"utf8",
		);
		const actions = readFileSync(
			"components/dashboard/client-actions.ts",
			"utf8",
		);
		const scansRoute = readFileSync("app/api/scans/[id]/route.ts", "utf8");
		const evidenceRoute = readFileSync("app/api/evidence/route.ts", "utf8");
		const evidenceItemRoute = readFileSync(
			"app/api/evidence/[id]/route.ts",
			"utf8",
		);

		expect(actions).toContain("updateScanRecord");
		expect(actions).toContain("deleteScanRecord");
		expect(actions).toContain("createEvidenceRecord");
		expect(actions).toContain("updateEvidenceRecord");
		expect(actions).toContain("deleteEvidenceRecord");
		expect(actions).toContain("createTrackedSourceRecord");
		expect(actions).toContain("updateTrackedSourceRecord");
		expect(actions).toContain("deleteTrackedSourceRecord");
		expect(actions).toContain("runManagedSchedulerJobNow");
		expect(dashboard).toContain("customReports");
		expect(dashboard).toContain("onCreateReport");
		expect(dashboard).toContain("onUpdateReport");
		expect(dashboard).toContain("onDeleteReport");
		expect(sourcesPage).toContain("onEditScan");
		expect(sourcesPage).toContain("onDeleteScan");
		expect(pages).toContain("onCreateEvidence");
		expect(pages).toContain("onEditEvidence");
		expect(pages).toContain("onDeleteEvidence");
		expect(sourcesPage).toContain("Đang theo dõi");
		expect(sourcesPage).toContain("Đã tắt");
		expect(sourcesPage).toContain("Tắt tự động quét hằng ngày");
		expect(sourcesPage).toContain("Bật tự động quét hằng ngày");
		expect(sourcesPage).toContain("SourceTabs");
		expect(sourcesPage).toContain("Tự động tái quét");
		expect(sourcesPage).toContain("Xếp hàng ngay");
		expect(sourcesPage).toContain("Xử lý ngay");
		expect(sourcesPage).toContain("Nguồn đến hạn");
		expect(sourcesPage).toContain("Quy tắc tự động");
		expect(sourcesPage).toContain(
			"Tìm theo tên trang, username, Facebook ID hoặc URL",
		);
		expect(scansRoute).toContain("export async function PATCH");
		expect(scansRoute).toContain("export async function DELETE");
		expect(evidenceRoute).toContain("export async function POST");
		expect(evidenceItemRoute).toContain("export async function PATCH");
		expect(evidenceItemRoute).toContain("export async function DELETE");
	});

	test("dashboard exposes workspace member management through the shared layout", () => {
		const data = readFileSync("components/dashboard/dashboard-data.ts", "utf8");
		const types = readFileSync("components/dashboard/types.ts", "utf8");
		const dashboard = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);
		const page = readFileSync(
			"components/dashboard/workspace-members-page.tsx",
			"utf8",
		);
		const queries = readFileSync("lib/dashboard/client-queries.ts", "utf8");
		const appPage = readFileSync("app/members/page.tsx", "utf8");
		const proxy = readFileSync("lib/workspace-members/proxy.ts", "utf8");

		expect(data).toContain('href: "/members"');
		expect(data).toContain("Thành viên");
		expect(types).toContain('| "members"');
		expect(dashboard).toContain('case "members"');
		expect(appPage).toContain("getWorkspaceMembersInitialData");
		expect(appPage).toContain("WorkspaceMembersPage");
		expect(page).toContain("workspaceMembersQueryOptions");
		expect(queries).toContain('fetchJson("/api/workspace/members")');
		expect(page).toContain("/api/workspace/members/invitations");
		expect(page).toContain("/api/workspace/members/default-admin");
		expect(page).toContain("confirmDefaultAdminDisable");
		expect(proxy).toContain("getBearerForPlatformRequest");
		expect(proxy).toContain("fetchTuturuuuWithBearer");
		expect(proxy).not.toContain("CYBERSHIELD35_APP_SECRET");
		expect(page.match(/membersQuery\.refetch\(\)/gu)).toHaveLength(1);
		expect(page.match(/invalidateQueries\(/gu)).toHaveLength(1);
	});

	test("dashboard hydrates TanStack Query data from server routes", () => {
		const config = readFileSync("next.config.ts", "utf8");
		const layout = readFileSync("app/layout.tsx", "utf8");
		const route = readFileSync("components/dashboard/dashboard-route.tsx", "utf8");
		const dashboard = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);
		const queryKeys = readFileSync("lib/dashboard/query-keys.ts", "utf8");
		const initialRoute = readFileSync(
			"app/api/dashboard/initial/route.ts",
			"utf8",
		);

		expect(config).toContain("staleTimes");
		expect(config).toContain("dynamic: 120");
		expect(layout).not.toContain("QueryProvider");
		expect(route).toContain("QueryProvider");
		expect(route).toContain("HydrationBoundary");
		expect(route).toContain("dehydrate(queryClient)");
		expect(dashboard).toContain("useQuery");
		expect(dashboard).toContain("invalidateQueries");
		expect(queryKeys).toContain("5 * 60_000");
		expect(initialRoute).toContain("getDashboardInitialData");
		expect(initialRoute).toContain("requireAdminSession");
	});

	test("dashboard makes topics a first-class operational page", () => {
		const data = readFileSync("components/dashboard/dashboard-data.ts", "utf8");
		const types = readFileSync("components/dashboard/types.ts", "utf8");
		const dashboard = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);
		const topicsPage = readFileSync(
			"components/dashboard/topics-page.tsx",
			"utf8",
		);
		const topicDetailsPage = readFileSync(
			"components/dashboard/topic-details-page.tsx",
			"utf8",
		);
		const appPage = readFileSync("app/topics/page.tsx", "utf8");
		const topicDetailPage = readFileSync("app/topics/[slug]/page.tsx", "utf8");
		const widgets = readFileSync(
			"components/dashboard/analysis-widgets.tsx",
			"utf8",
		);

		expect(data).toContain('href: "/topics"');
		expect(data).toContain("Chủ đề");
		expect(types).toContain('| "topics"');
		expect(dashboard).toContain('case "topics"');
		expect(dashboard).toContain('case "topic-detail"');
		expect(appPage).toContain("<TopicsWorkspace");
		expect(appPage).toContain("HydrationBoundary");
		expect(topicDetailPage).toContain("<TopicDetailsContent");
		expect(topicDetailPage).toContain("topicSlug={slug}");
		expect(topicsPage).toContain("export function TopicsPage");
		expect(topicDetailsPage).toContain("export function TopicDetailsPage");
		expect(widgets).toContain("TopicExplorer");
		expect(widgets).toContain("TopicDetailPanel");
		expect(widgets).toContain("buildTopicInsights");
	});

	test("dashboard uses client-side infinite loading for heavy lists", () => {
		const queries = readFileSync("lib/dashboard/client-queries.ts", "utf8");
		const queryKeys = readFileSync("lib/dashboard/query-keys.ts", "utf8");
		const scansRoute = readFileSync("app/api/scans/route.ts", "utf8");
		const evidenceRoute = readFileSync(
			"app/api/scans/[id]/evidence/route.ts",
			"utf8",
		);
		const widgets = readFileSync(
			"components/dashboard/page-widgets.tsx",
			"utf8",
		);
		const analysisWidgets = readFileSync(
			"components/dashboard/analysis-widgets.tsx",
			"utf8",
		);
		const pages = readFileSync(
			"components/dashboard/dashboard-pages.tsx",
			"utf8",
		);
		const sourcesPage = readFileSync(
			"components/dashboard/sources-page.tsx",
			"utf8",
		);

		expect(queryKeys).toContain("scansInfinite");
		expect(queryKeys).toContain("scanEvidenceInfinite");
		expect(queries).toContain("dashboardScansInfiniteQueryOptions");
		expect(queries).toContain("scanEvidenceInfiniteQueryOptions");
		expect(scansRoute).toContain("nextCursor");
		expect(scansRoute).toContain("listScansPage");
		expect(evidenceRoute).toContain("listEvidenceForScanPage");
		expect(widgets).toContain("useInfiniteQuery");
		expect(analysisWidgets).toContain("useInfiniteQuery");
		expect(pages).toContain("enableInfinite");
		expect(sourcesPage).toContain("enableInfinite");
	});

	test("dashboard persists topics and exposes dedicated related-post APIs", () => {
		const schema = readFileSync("lib/db/schema.ts", "utf8");
		const topicWorker = readFileSync("lib/workers/topics.ts", "utf8");
		const scanWorker = readFileSync("lib/workers/scans.ts", "utf8");
		const topicRoute = readFileSync("app/api/topics/route.ts", "utf8");
		const topicDetailRoute = readFileSync(
			"app/api/topics/[slug]/route.ts",
			"utf8",
		);
		const migration = readFileSync(
			"drizzle/0005_daffy_ender_wiggin.sql",
			"utf8",
		);
		const packageJson = readFileSync("package.json", "utf8");

		expect(schema).toContain("export const topics");
		expect(schema).toContain("export const evidenceTopics");
		expect(topicWorker).toContain("syncTopicsForScan");
		expect(topicWorker).toContain("backfillTopicsFromAnalyses");
		expect(scanWorker).toContain("syncTopicsForScan(claimed.id");
		expect(scanWorker).toContain("syncExistingAnalysisTopicsForScan");
		expect(topicRoute).toContain("listTopicsPage");
		expect(topicDetailRoute).toContain("getTopicDetailPage");
		expect(migration).toContain('CREATE TABLE "topics"');
		expect(migration).toContain('CREATE TABLE "evidence_topics"');
		expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
		expect(packageJson).toContain("db:backfill-topics");
	});

	test("dashboard adds operator analytics and overflow-safe prose", () => {
		const layout = readFileSync("app/layout.tsx", "utf8");
		const telemetry = readFileSync("components/providers/telemetry.tsx", "utf8");
		const overviewPage = readFileSync(
			"components/dashboard/overview-page.tsx",
			"utf8",
		);
		const intelligenceWidgets = readFileSync(
			"components/dashboard/intelligence-widgets.tsx",
			"utf8",
		);
		const intelligenceShared = readFileSync(
			"components/dashboard/intelligence-workspace-shared.tsx",
			"utf8",
		);
		const intelligenceEvidenceRow = readFileSync(
			"components/dashboard/intelligence-evidence-row.tsx",
			"utf8",
		);
		const widgets = readFileSync(
			"components/dashboard/page-widgets.tsx",
			"utf8",
		);
		const analysisWidgets = readFileSync(
			"components/dashboard/analysis-widgets.tsx",
			"utf8",
		);

		expect(layout).toContain("<Telemetry />");
		expect(telemetry).toContain("@vercel/analytics/next");
		expect(telemetry).toContain("@vercel/speed-insights/next");
		expect(overviewPage).toContain("<ExecutiveIntelligenceDashboard");
		expect(overviewPage).toContain("Tổng quan tình báo điều hành");
		expect(intelligenceWidgets).toContain("Xu hướng rủi ro và bằng chứng");
		expect(intelligenceWidgets).toContain("Động lượng chủ đề");
		expect(intelligenceWidgets).toContain("Sẵn sàng báo cáo");
		expect(intelligenceShared).toContain("Tất cả fanpage");
		expect(intelligenceShared).toContain("Facebook ID");
		expect(intelligenceEvidenceRow).toContain("Facebook ID");
		expect(intelligenceEvidenceRow).toContain("Bài gốc");
		expect(intelligenceEvidenceRow).toContain("Mở scan");
		expect(intelligenceEvidenceRow).toContain("line-clamp-2");
		expect(widgets).toContain("break-words");
		expect(widgets).toContain("[-webkit-line-clamp:6]");
		expect(analysisWidgets).toContain("[-webkit-line-clamp:3]");
	});

	test("dashboard exposes manual scan run actions for when cron is unavailable", () => {
		const runRoute = readFileSync("app/api/scans/[id]/run/route.ts", "utf8");
		const actions = readFileSync(
			"components/dashboard/client-actions.ts",
			"utf8",
		);
		const widgets = readFileSync(
			"components/dashboard/page-widgets.tsx",
			"utf8",
		);
		const sourcesPage = readFileSync(
			"components/dashboard/sources-page.tsx",
			"utf8",
		);
		const dashboard = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);

		expect(runRoute).toContain("export async function POST");
		expect(runRoute).toContain("processScanJobNow");
		expect(actions).toContain("runScanRecord");
		expect(actions).toContain("/api/workspace/cron/jobs");
		expect(widgets).toContain("onRunScan");
		expect(widgets).toContain("aria-label=\"Chạy scan ngay\"");
		expect(sourcesPage).toContain("onRunScan");
		expect(sourcesPage).toContain("onRunSchedulerJob");
		expect(sourcesPage).toContain("managedSchedulerQueryOptions");
		expect(dashboard).toContain("runScanRecord");
		expect(dashboard).toContain("runManagedSchedulerJobNow");
	});

	test("loads the sources workspace from its own client module", () => {
		const dashboard = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);
		const pages = readFileSync(
			"components/dashboard/dashboard-pages.tsx",
			"utf8",
		);
		const sourcesPage = readFileSync(
			"components/dashboard/sources-page.tsx",
			"utf8",
		);

		expect(dashboard).toContain('import("@/components/dashboard/sources-page")');
		expect(sourcesPage).toContain("export function SourcesPage");
		expect(sourcesPage).toContain("function SourceAutomationPanel");
		expect(sourcesPage).toContain("function TrackedSourcesPanel");
		expect(sourcesPage).toContain("function sourceAutomationState");
		expect(pages).not.toContain("export function SourcesPage");
		expect(pages).not.toContain("function SourceAutomationPanel");
	});

	test("managed scheduler uses Vercel Cron instead of Tuturuuu managed-cron", () => {
		const panel = readFileSync(
			"components/dashboard/managed-scheduler-panel.tsx",
			"utf8",
		);
		const queries = readFileSync("lib/dashboard/client-queries.ts", "utf8");
		const server = readFileSync("lib/managed-scheduler/server.ts", "utf8");
		const processRoute = readFileSync(
			"app/api/cron/scans/process-queue/route.ts",
			"utf8",
		);
		const trackedRoute = readFileSync(
			"app/api/cron/scans/enqueue-tracked-sources/route.ts",
			"utf8",
		);
		const vercelConfig = readFileSync("vercel.json", "utf8");

		expect(queries).toContain("parseManagedSchedulerStatusResponse");
		expect(queries).not.toContain('return fetchJson("/api/workspace/cron")');
		expect(panel).toContain("queryUnavailable");
		expect(panel).toContain("query.refetch()");
		expect(panel).toContain("Không thể kiểm tra managed scheduler");
		expect(panel).toContain("Vercel Cron scheduler");
		expect(panel).toContain("CRON_SECRET");
		expect(panel).toContain("ImmediateCronActions");
		expect(panel).toContain('runMutation.mutate("enqueue-tracked-sources")');
		expect(panel).toContain('runMutation.mutate("process-queue")');
		expect(panel).toContain("Tạo scan ngay");
		expect(panel).toContain("Xử lý ngay");
		expect(panel).toContain("lockedByDeployment");
		expect(panel).toContain("vercel.json");
		expect(panel).toContain("status?.approvalHref && !controlsDisabled");
		expect(panel).toContain("href={status.approvalHref}");
		expect(panel).toContain("Duyệt thiết lập");
		expect(panel).toContain("canOpenRecovery");
		expect(panel).toContain("href={status?.adminRecoveryHref}");
		expect(panel).toContain("Khôi phục cron");
		expect(panel).toContain("FALLBACK_MANAGED_JOBS");
		expect(panel).toContain("hasLocalScheduler");
		expect(panel).toContain("enabled: hasLocalScheduler");
		expect(panel).toContain("remoteStatusAvailable === false");
		expect(panel).toContain("remoteStatusUnknown");
		expect(panel).toContain("Đã cấu hình cục bộ, chưa lấy được trạng thái Tuturuuu");
		expect(panel).toContain("Không thể tải lịch sử chạy");
		expect(panel).toContain("executionFailureInsight");
		expect(panel).toContain("Tuturuuu runner could not connect to the CS35 callback");
		expect(panel).toContain("CS35 rejected the scheduler token");
		expect(panel).toContain("cs35_managed_scheduler_callback_failed");
		expect(panel).toContain("disabled={controlsDisabled}");
		expect(panel).toContain("Duyệt thiết lập trên Tuturuuu");
		expect(panel).toContain("Mở trang vận hành Tuturuuu");
		expect(panel).toContain("missingApprovalItems");
		expect(panel).toContain("setupDisabledReason");
		expect(panel).toContain("!status?.setupDisabledReason");
		expect(server).toContain("VERCEL_CRON_SECRET_MISSING");
		expect(server).toContain("runVercelCronRoute");
		expect(server).toContain("CRON_SECRET");
		expect(server).not.toContain("buildManagedSchedulerUrl");
		expect(processRoute).toContain("export async function GET");
		expect(processRoute).toContain("runVercelCronRoute");
		expect(trackedRoute).toContain("export async function GET");
		expect(trackedRoute).toContain("runVercelCronRoute");
		expect(vercelConfig).toContain("/api/cron/scans/process-queue");
		expect(vercelConfig).toContain("*/30 * * * *");
		expect(vercelConfig).toContain("/api/cron/scans/enqueue-tracked-sources");
		expect(vercelConfig).toContain("0 0 * * *");
	});

	test("managed scheduler callbacks return sanitized structured failures", () => {
		const processRoute = readFileSync(
			"app/api/cron/scans/process-queue/route.ts",
			"utf8",
		);
		const trackedRoute = readFileSync(
			"app/api/cron/scans/enqueue-tracked-sources/route.ts",
			"utf8",
		);
		const callback = readFileSync(
			"lib/managed-scheduler/callback.ts",
			"utf8",
		);

		expect(processRoute).toContain("managedSchedulerCallbackFailureBody");
		expect(processRoute).toContain('const JOB_KEY = "process-queue"');
		expect(processRoute).toContain("operation: JOB_KEY");
		expect(trackedRoute).toContain("managedSchedulerCallbackFailureBody");
		expect(trackedRoute).toContain(
			'const JOB_KEY = "enqueue-tracked-sources"',
		);
		expect(trackedRoute).toContain("operation: JOB_KEY");
		expect(callback).toContain("CS35_MANAGED_SCHEDULER_CALLBACK_FAILED");
		expect(callback).toContain("developerDebug");
		expect(callback).not.toContain("stack");
	});

	test("database client prefers pooled production connection URLs", () => {
		const client = readFileSync("lib/db/client.ts", "utf8");

		expect(client).toContain("firstConfiguredEnv");
		expect(client).toContain('"CS35_DATABASE_URL"');
		expect(client).toContain('"POSTGRES_URL"');
		expect(client).toContain('"POSTGRES_PRISMA_URL"');
		expect(client).toContain('"DATABASE_URL"');
		expect(client.indexOf('"POSTGRES_URL"')).toBeLessThan(
			client.indexOf('"DATABASE_URL"'),
		);
	});

	test("notification dropdown has no mock operational items", () => {
		const shell = readFileSync("components/dashboard/shell.tsx", "utf8");
		const pages = readFileSync(
			"components/dashboard/dashboard-pages.tsx",
			"utf8",
		);

		expect(shell).toContain(
			"const notifications: OperationalNotification[] = []",
		);
		expect(shell).not.toContain("Scan Facebook đang chạy");
		expect(shell).not.toContain("Bản nháp cần duyệt");
		expect(shell).not.toContain("Cảnh báo rủi ro cao");
		expect(pages).not.toContain("Thông báo trên thanh trên cùng");
	});

	test("alerts and claims deep link to evidence with explanatory tooltips", () => {
		const widgets = readFileSync(
			"components/dashboard/analysis-widgets.tsx",
			"utf8",
		);
		const alertsPage = readFileSync(
			"components/dashboard/alerts-page.tsx",
			"utf8",
		);
		const primitives = readFileSync(
			"components/dashboard/ui-primitives.tsx",
			"utf8",
		);
		const intelligenceWidgets = readFileSync(
			"components/dashboard/intelligence-widgets.tsx",
			"utf8",
		);
		const types = readFileSync("components/dashboard/types.ts", "utf8");
		const dashboard = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);

		expect(types).toContain("export type ClaimView");
		expect(types).toContain("evidenceIds: string[]");
		expect(dashboard).toContain("claims: []");
		expect(dashboard).toContain("claims: isClaimArray(input.claims)");
		expect(widgets).toContain("function relatedEvidenceForFlag");
		expect(widgets).toContain("function EvidenceDeepLinks");
		expect(widgets).toContain("evidenceHref(item, scanId)");
		expect(widgets).toContain("href={evidenceHref(item, scanId)}");
		expect(widgets).toContain("export function ClaimEvidencePanel");
		expect(widgets).toContain("claim.evidenceIds");
		expect(widgets).toContain("stanceTooltip");
		expect(alertsPage).toContain("<IntelligenceClaimsWorkspace");
		expect(intelligenceWidgets).toContain("evidenceHrefs");
		expect(intelligenceWidgets).toContain("Đồ thị claim");
		expect(intelligenceWidgets).toContain("href={claim.deepLink}");
		expect(primitives).toContain("export function DashboardTooltip");
		expect(primitives).toContain("@tuturuuu/ui/tooltip");
		expect(primitives).toContain("Rủi ro cao");
		expect(primitives).toContain("Scan đã được tạo");
	});

	test("verify-token callback page completes login without manual token entry", () => {
		const page = readFileSync("app/verify-token/page.tsx", "utf8");
		const client = readFileSync(
			"components/auth/verify-token-client.tsx",
			"utf8",
		);

		expect(page).toContain("VerifyTokenClient");
		expect(client).toContain('searchParams.get("token")');
		expect(client).toContain('fetch("/api/auth/verify-app-token"');
		expect(client).toContain("router.replace(nextPath)");
		expect(client).toContain('loginHref(nextPath, "invalid-link")');
		expect(client).toContain('loginHref(nextPath, "no-access")');
		expect(client).toContain('loginHref(nextPath, "scope")');
		expect(client).toContain('"PENDING_WORKSPACE_INVITE"');
		expect(client).toContain("pendingInvitation");
		expect(client).not.toContain("invitationUrl");
		expect(client).toContain("scopeApprovalHref");
		expect(client).not.toContain("href={retryHref}");
		expect(client).not.toContain("Duyệt quyền truy cập");
		expect(client).not.toContain("<input");
		expect(client).not.toContain("Dán token");
		expect(client).not.toContain("Short app token");
	});

	test("auth provider branding stays on the login surface", () => {
		const loginPage = readFileSync("app/login/page.tsx", "utf8");
		const loginScreen = readFileSync(
			"components/auth/centralized-login-screen.tsx",
			"utf8",
		);
		const verifyPage = readFileSync("app/verify-token/page.tsx", "utf8");
		const verifyClient = readFileSync(
			"components/auth/verify-token-client.tsx",
			"utf8",
		);

		expect(loginPage).toContain("Tuturuuu");
		expect(loginScreen).toContain("Tuturuuu");
		expect(verifyPage).not.toContain("Tuturuuu");
		expect(verifyClient).not.toContain("Tuturuuu");
	});

	test("verify-token callback does not return to the dashboard without a token", () => {
		const client = readFileSync(
			"components/auth/verify-token-client.tsx",
			"utf8",
		);

		expect(client).toContain("if (!token) {");
		expect(client).toContain("router.replace(invalidLinkHref)");
		expect(client).not.toContain('setState("failed")');
		expect(client).not.toContain("Phiên đăng nhập không hợp lệ");
		expect(client).toContain("/login?${params.toString()}");
		expect(client).not.toContain(
			"if (!token) {\n\t\t\t\trouter.replace(nextPath)",
		);
		expect(client).not.toContain("if (!token) {\n\t\t\t\trouter.refresh()");
		expect(client).not.toContain('href="/"');
	});

	test("dashboard client redirects instead of rendering the app shell without auth", () => {
		const source = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);

		expect(source).toContain("if (!auth.authenticated)");
		expect(source).toContain("<LoginRedirect");
		expect(source).toContain("/login?reason=expired");
		expect(source).not.toContain("<LockedDashboard");
		expect(source).not.toContain("scopeApprovalHref={auth.scopeApprovalHref}");
		expect(source).not.toContain("Duyệt quyền truy cập");
		expect(source).not.toContain("export function LockedDashboard");
		expect(source).not.toContain("href={loginHref}");
		expect(source).not.toContain('href="/"');
		expect(source).not.toContain("Đăng nhập để tiếp tục");
	});

	test("logout routes back to the empty centralized login state", () => {
		const actions = readFileSync(
			"components/dashboard/auth-client-actions.ts",
			"utf8",
		);
		const dashboardActions = readFileSync(
			"components/dashboard/client-actions.ts",
			"utf8",
		);
		const shell = readFileSync(
			"components/dashboard/dashboard-layout-shell.tsx",
			"utf8",
		);
		const loginScreen = readFileSync(
			"components/auth/centralized-login-screen.tsx",
			"utf8",
		);

		expect(actions).toContain("window.location.assign");
		expect(actions).toContain('loginHref ?? "/login"');
		expect(actions).not.toContain("/login?reason=logged-out");
		expect(dashboardActions).not.toContain("export async function logout");
		expect(shell).toContain(
			'import { logout } from "@/components/dashboard/auth-client-actions"',
		);
		expect(shell).toContain("auth.loginHref ?? currentLoginHref()");
		expect(shell).not.toContain('currentLoginHref("logged-out")');
		expect(shell).toContain("<LoginRedirect");
		expect(loginScreen).not.toContain("Phiên hiện tại đã được đóng");
		expect(loginScreen).not.toContain("Bạn đã đăng xuất an toàn");
		expect(loginScreen).not.toContain("Đăng nhập trung tâm cho bảng điều khiển vận hành");
		expect(loginScreen).not.toContain("Một điểm vào duy nhất");
		expect(loginScreen).not.toContain("AuthSignal");
		expect(loginScreen).not.toContain('label="Provider"');
		expect(loginScreen).not.toContain('label="Workspace"');
		expect(loginScreen).not.toContain('label="Session"');
	});

	test("dark theme uses a neutral gray dashboard palette", () => {
		const globals = readFileSync("app/globals.css", "utf8");

		for (const token of [
			"--background: #10151d",
			"--surface: #161d27",
			"--surface-elevated: #1b2430",
			"--surface-soft: #202936",
			"--border: #273444",
			"--border-strong: #3b4b5e",
			"--divider: #243040",
			"--muted: #94a3b8",
			"--muted-strong: #cbd5e1",
			"--accent: #60a5fa",
			"--accent-strong: #bfdbfe",
			"--accent-soft: #172b45",
		]) {
			expect(globals).toContain(token);
		}

		expect(globals).toContain("linear-gradient(180deg, rgb(22 29 39");
		expect(globals).not.toContain("#06120d");
		expect(globals).not.toContain("#0a1711");
		expect(globals).not.toContain("orb");
		expect(globals).not.toContain("bokeh");
	});
});
