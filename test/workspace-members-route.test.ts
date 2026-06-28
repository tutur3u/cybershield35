import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { GET } from "@/app/api/workspace/members/route";
import { DELETE } from "@/app/api/workspace/members/access/route";
import { PATCH as PATCH_DEFAULT_ADMIN } from "@/app/api/workspace/members/default-admin/route";
import { POST } from "@/app/api/workspace/members/invitations/route";
import { PATCH as PATCH_ROLE } from "@/app/api/workspace/members/[userId]/role/route";
import {
	createSessionCookie,
	getRequestedScopes,
	readAdminSession,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function session(
	overrides: Partial<TuturuuuAdminSession> = {},
): TuturuuuAdminSession {
	return {
		accessToken: "access-token",
		app: { name: "cybershield35" },
		createdAt: "2026-06-13T00:00:00.000Z",
		expiresAt: new Date(Date.now() + 60_000).toISOString(),
		expiresIn: 60,
		identityRefreshedAt: "2026-06-13T00:01:00.000Z",
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
		...overrides,
	};
}

function exchangeBody() {
	return {
		accessToken: "new-access-token",
		app: { name: "cybershield35" },
		expiresAt: new Date(Date.now() + 120_000).toISOString(),
		expiresIn: 120,
		refreshEarlySeconds: 10,
		refreshExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
		refreshExpiresIn: 3600,
		refreshToken: "new-refresh-token",
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

function request(path: string, body?: unknown, cookie?: string) {
	return new Request(`https://cybershield.example.com${path}`, {
		body: body === undefined ? undefined : JSON.stringify(body),
		headers: {
			...(body === undefined ? {} : { "Content-Type": "application/json" }),
			...(cookie ? { cookie } : {}),
		},
		method: body === undefined ? "GET" : "POST",
	});
}

beforeEach(() => {
	process.env = {
		...originalEnv,
		CYBERSHIELD35_APP_ID: "cybershield35",
		CYBERSHIELD35_APP_SECRET: "app-secret",
		CYBERSHIELD35_SESSION_SECRET:
			"test-secret-for-cybershield35-session-cookie",
		NODE_ENV: "production",
		TUTURUUU_API_BASE_URL: "https://tuturuuu.com/api/v1",
		TUTURUUU_CYBERSHIELD35_WORKSPACE_ID: "workspace-1",
	};
});

afterEach(() => {
	process.env = { ...originalEnv };
	globalThis.fetch = originalFetch;
	mock.restore();
});

describe("workspace members proxy routes", () => {
	test("rejects unauthenticated requests", async () => {
		const response = await GET(
			request("/api/workspace/members") as unknown as Request,
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Authentication required" });
	});

	test("rejects invalid invitation payloads before forwarding", async () => {
		const fetchMock = mock(() => Promise.resolve(new Response("{}")));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const response = await POST(
			request(
				"/api/workspace/members/invitations",
				{ emails: ["bad-email"] },
				createSessionCookie(session()),
			),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Invalid invitation payload",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("forwards member list requests with the current bearer token", async () => {
		const fetchMock = mock((url: string | URL, init?: RequestInit) => {
			expect(String(url)).toBe(
				"https://tuturuuu.com/api/v1/workspaces/workspace-1/external-apps/members",
			);
			expect(init?.headers).toMatchObject({
				Authorization: "Bearer access-token",
			});
			return Promise.resolve(
				Response.json({
					context: {
						canManageMembers: true,
						canManageRoles: true,
						defaultAdminEnabled: false,
					},
					invitations: [],
					members: [],
				}),
			);
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const response = await GET(
			request(
				"/api/workspace/members",
				undefined,
				createSessionCookie(session()),
			),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			context: { canManageMembers: true },
			members: [],
		});
	});

	test("refreshes the session cookie before forwarding stale requests", async () => {
		const fetchMock = mock((url: string | URL, init?: RequestInit) => {
			const pathname = new URL(String(url)).pathname;
			if (pathname.endsWith("/auth/app-token/exchange")) {
				expect(JSON.parse(String(init?.body))).toMatchObject({
					refreshToken: "refresh-token",
					requestedScopes: [
						"workspace:session",
						"workspace:members:read",
						"workspace:members:write",
						"workspace:roles:read",
						"workspace:roles:write",
						"workspace:cron:read",
						"workspace:cron:write",
						"users:profile:read",
						"users:profile:write",
					],
				});
				return Promise.resolve(Response.json(exchangeBody()));
			}

			expect(init?.headers).toMatchObject({
				Authorization: "Bearer new-access-token",
			});
			return Promise.resolve(
				Response.json({ message: "1 invite(s) sent successfully" }),
			);
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const response = await POST(
			request(
				"/api/workspace/members/invitations",
				{ emails: ["New@Example.com"] },
				createSessionCookie(
					session({
						expiresAt: new Date(Date.now() + 1000).toISOString(),
					}),
				),
			),
		);

		expect(response.status).toBe(200);
		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).toContain("cybershield35_admin_session=");
		const refreshed = await readAdminSession(
			new Request("https://cybershield.example.com", {
				headers: { cookie: setCookie ?? "" },
			}),
		);
		expect(refreshed?.accessToken).toBe("new-access-token");
	});

	test("passes upstream errors through for role updates", async () => {
		const fetchMock = mock(() =>
			Promise.resolve(
				Response.json({ message: "At least one workspace admin is required" }, { status: 403 }),
			),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const response = await PATCH_ROLE(
			request(
				"/api/workspace/members/user-2/role",
				{ role: "member" },
				createSessionCookie(session()),
			),
			{ params: Promise.resolve({ userId: "user-2" }) },
		);

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({
			message: "At least one workspace admin is required",
		});
	});

	test("forwards access removal and default admin updates", async () => {
		const paths: string[] = [];
		const fetchMock = mock((url: string | URL) => {
			paths.push(new URL(String(url)).pathname);
			return Promise.resolve(Response.json({ message: "success" }));
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		const cookie = createSessionCookie(session());

		const removeResponse = await DELETE(
			request(
				"/api/workspace/members/access",
				{ email: "Pending@Example.com" },
				cookie,
			),
		);
		const defaultResponse = await PATCH_DEFAULT_ADMIN(
			request(
				"/api/workspace/members/default-admin",
				{ enabled: true },
				cookie,
			),
		);

		expect(removeResponse.status).toBe(200);
		expect(defaultResponse.status).toBe(200);
		expect(paths).toEqual([
			"/api/v1/workspaces/workspace-1/external-apps/members/access",
			"/api/v1/workspaces/workspace-1/external-apps/members/default-admin",
		]);
	});
});
