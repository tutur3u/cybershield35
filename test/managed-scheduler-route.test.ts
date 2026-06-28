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
