import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import {
	createSessionCookie,
	getRequestedScopes,
	readAdminSession,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

const missingRelationError = Object.assign(
	new Error('relation "managed_scheduler_integrations" does not exist'),
	{ code: "42P01" },
);
const dbMode = { missingStorage: true };
const selectLimit = mock(async () => {
	if (dbMode.missingStorage) throw missingRelationError;
	return [];
});
const insertReturning = mock(async () => {
	if (dbMode.missingStorage) throw missingRelationError;
	return [
		{
			createdAt: new Date("2026-06-28T00:00:00.000Z"),
			enabled: true,
			id: "integration-1",
			provider: "managed-scheduler",
			setupMetadata: {},
			tokenHash: "hash",
			tokenLastFour: "1234",
			updatedAt: new Date("2026-06-28T00:00:00.000Z"),
		},
	];
});

mock.module("server-only", () => ({}));

mock.module("@/lib/db/client", () => ({
	adminDb: {
		insert: () => ({
			values: () => ({
				onConflictDoUpdate: () => ({
					returning: insertReturning,
				}),
			}),
		}),
		select: () => ({
			from: () => ({
				where: () => ({
					limit: selectLimit,
				}),
			}),
		}),
	},
}));

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

function request(path: string, cookie?: string) {
	return new Request(`https://cybershield.example.com${path}`, {
		headers: cookie ? { cookie } : undefined,
		method: path.endsWith("/setup") ? "POST" : "GET",
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
	dbMode.missingStorage = true;
	selectLimit.mockClear();
	insertReturning.mockClear();
});

afterEach(() => {
	process.env = { ...originalEnv };
	globalThis.fetch = originalFetch;
	mock.restore();
});

describe("managed scheduler proxy routes", () => {
	test("returns a sanitized readiness state when local scheduler storage is missing", async () => {
		const fetchMock = mock(() => Promise.resolve(Response.json({ jobs: [] })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const { GET } = await import("@/app/api/workspace/cron/route");
		const response = await GET(
			request("/api/workspace/cron", createSessionCookie(session())),
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			code: "LOCAL_SCHEDULER_STORAGE_NOT_READY",
			configured: false,
			enabled: false,
			localStorageReady: false,
			setupDisabled: true,
		});
		expect(JSON.stringify(body)).not.toContain("Failed query");
		expect(JSON.stringify(body)).not.toContain(
			"managed_scheduler_integrations",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("does not call remote setup while local scheduler storage is missing", async () => {
		const fetchMock = mock(() => Promise.resolve(Response.json({ jobs: [] })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const { POST } = await import("@/app/api/workspace/cron/setup/route");
		const response = await POST(
			request("/api/workspace/cron/setup", createSessionCookie(session())),
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(503);
		expect(body).toMatchObject({
			code: "LOCAL_SCHEDULER_STORAGE_NOT_READY",
			setupDisabled: true,
		});
		expect(JSON.stringify(body)).not.toContain("Failed query");
		expect(JSON.stringify(body)).not.toContain(
			"managed_scheduler_integrations",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("returns sanitized scheduler state when the upstream status check fails", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock(() =>
			Promise.resolve(
				Response.json(
					{
						code: "MANAGED_CRON_UNAVAILABLE",
						message: "Managed scheduler provider is unavailable.",
						secret: "raw-secret",
					},
					{ status: 503 },
				),
			),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const { GET } = await import("@/app/api/workspace/cron/route");
		const response = await GET(
			request("/api/workspace/cron", createSessionCookie(session())),
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			code: "MANAGED_CRON_UNAVAILABLE",
			configured: false,
			enabled: false,
			error: "Managed scheduler provider is unavailable.",
			localStorageReady: true,
			setupDisabled: true,
		});
		expect(JSON.stringify(body)).not.toContain("raw-secret");
		expect(JSON.stringify(body)).not.toContain("Failed query");
	});

	test("returns scheduler approval state when upstream setup needs domain approval", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock((url: string | URL, init?: RequestInit) => {
			expect(new URL(String(url)).pathname).toBe(
				"/api/v1/workspaces/workspace-1/external-apps/cron/setup",
			);
			expect(JSON.parse(String(init?.body))).toMatchObject({
				origin: "https://cybershield.example.com",
			});
			return Promise.resolve(
				Response.json(
					{
						code: "CRON_APPROVAL_REQUIRED",
						error: "Managed scheduler approval required",
						missing: ["domain"],
						origin: "https://cybershield.example.com",
						workspaceId: "workspace-1",
					},
					{ status: 403 },
				),
			);
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const { POST } = await import("@/app/api/workspace/cron/setup/route");
		const response = await POST(
			request("/api/workspace/cron/setup", createSessionCookie(session())),
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(403);
		expect(body).toMatchObject({
			approvalReason: "Managed scheduler approval required",
			code: "CRON_APPROVAL_REQUIRED",
			error: "Managed scheduler approval required",
			missingApprovalItems: ["domain"],
			setupDisabled: true,
			setupOrigin: "https://cybershield.example.com",
		});
		const approvalUrl = new URL(String(body.approvalHref));
		expect(approvalUrl.searchParams.get("feature")).toBe("managed-cron");
		expect(approvalUrl.searchParams.get("workspaceId")).toBe("workspace-1");
		expect(approvalUrl.searchParams.get("origin")).toBe(
			"https://cybershield.example.com",
		);
		expect(approvalUrl.searchParams.getAll("scope")).toEqual(
			getRequestedScopes(),
		);
		const returnUrl = new URL(approvalUrl.searchParams.get("returnUrl") ?? "");
		expect(returnUrl.origin).toBe("https://cybershield.example.com");
		expect(returnUrl.pathname).toBe("/settings");
		expect(returnUrl.searchParams.get("cronSetup")).toBe("retry");
		expect(approvalUrl.toString()).not.toContain("app-secret");
		expect(approvalUrl.toString()).not.toContain("access-token");
		expect(approvalUrl.toString()).not.toContain("refresh-token");
		expect(approvalUrl.toString()).not.toContain("token=");
	});

	test("preserves missing origin and workspace approval items in approval URLs", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock(() =>
			Promise.resolve(
				Response.json(
					{
						code: "CRON_APPROVAL_REQUIRED",
						message: "Managed scheduler approval required",
						missing: ["origin", "workspace"],
						origin: "https://public-cs35.example.com",
						workspaceId: "workspace-1",
					},
					{ status: 403 },
				),
			),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const { GET } = await import("@/app/api/workspace/cron/route");
		const response = await GET(
			new Request("http://localhost:3000/api/workspace/cron", {
				headers: { cookie: createSessionCookie(session()) },
			}),
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			approvalReason: "Managed scheduler approval required",
			missingApprovalItems: ["origin", "workspace"],
			setupDisabled: true,
			setupOrigin: "https://public-cs35.example.com",
		});
		const approvalUrl = new URL(String(body.approvalHref));
		expect(approvalUrl.searchParams.get("origin")).toBe(
			"https://public-cs35.example.com",
		);
		expect(approvalUrl.searchParams.get("workspaceId")).toBe("workspace-1");
		const returnUrl = new URL(approvalUrl.searchParams.get("returnUrl") ?? "");
		expect(returnUrl.origin).toBe("https://public-cs35.example.com");
		expect(returnUrl.searchParams.get("cronSetup")).toBe("retry");
	});

	test("does not build approval links for local setup origins", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock((url: string | URL, init?: RequestInit) => {
			expect(new URL(String(url)).pathname).toBe(
				"/api/v1/workspaces/workspace-1/external-apps/cron/setup",
			);
			expect(JSON.parse(String(init?.body))).toMatchObject({
				origin: "http://localhost:3000",
			});
			return Promise.resolve(
				Response.json(
					{
						code: "CRON_APPROVAL_REQUIRED",
						error: "Managed scheduler approval required",
						missing: ["domain", "origin"],
						origin: "http://localhost:3000",
						workspaceId: "workspace-1",
					},
					{ status: 403 },
				),
			);
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const { POST } = await import("@/app/api/workspace/cron/setup/route");
		const response = await POST(
			new Request("http://localhost:3000/api/workspace/cron/setup", {
				headers: { cookie: createSessionCookie(session()) },
				method: "POST",
			}),
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(403);
		expect(body.approvalHref).toBeUndefined();
		expect(body).toMatchObject({
			missingApprovalItems: ["domain", "origin"],
			setupDisabled: true,
			setupOrigin: "http://localhost:3000",
		});
		expect(String(body.setupDisabledReason)).toContain(
			"CYBERSHIELD35_PUBLIC_APP_URL",
		);
	});

	test("returns scheduler approval state when scope refresh is denied", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock((url: string | URL) => {
			expect(new URL(String(url)).pathname).toBe(
				"/api/v1/auth/app-token/exchange",
			);
			return Promise.resolve(
				Response.json(
					{ error: "Requested scope is not allowed for this app" },
					{ status: 403 },
				),
			);
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const { GET } = await import("@/app/api/workspace/cron/route");
		const response = await GET(
			request(
				"/api/workspace/cron",
				createSessionCookie(session({ scopes: ["workspace:session"] })),
			),
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			configured: false,
			enabled: false,
			error: "Requested scope is not allowed for this app",
			setupDisabled: true,
		});
		const approvalUrl = new URL(String(body.approvalHref));
		expect(approvalUrl.pathname).toContain(
			"/internal/infrastructure/external-apps/approve",
		);
		expect(approvalUrl.searchParams.get("returnUrl")).toContain(
			"cronSetup=retry",
		);
	});

	test("refreshes stale scope sessions before scheduler setup", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock((url: string | URL, init?: RequestInit) => {
			const pathname = new URL(String(url)).pathname;
			if (pathname.endsWith("/auth/app-token/exchange")) {
				expect(JSON.parse(String(init?.body))).toMatchObject({
					refreshToken: "refresh-token",
					requestedScopes: getRequestedScopes(),
				});
				return Promise.resolve(Response.json(exchangeBody()));
			}

			expect(pathname).toBe(
				"/api/v1/workspaces/workspace-1/external-apps/cron/setup",
			);
			expect(init?.headers).toMatchObject({
				Authorization: "Bearer new-access-token",
			});
			return Promise.resolve(
				Response.json({
					configured: true,
					enabled: true,
					jobs: [],
				}),
			);
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const { POST } = await import("@/app/api/workspace/cron/setup/route");
		const response = await POST(
			request(
				"/api/workspace/cron/setup",
				createSessionCookie(session({ scopes: ["workspace:session"] })),
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
		expect(refreshed?.scopes).toEqual(getRequestedScopes());
	});
});
