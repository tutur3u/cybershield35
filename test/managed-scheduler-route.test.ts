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
			adminRecoveryHref:
				"https://tuturuuu.com/vi/internal/infrastructure/monitoring/cron?focus=cron-runner",
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

	test("preserves Tuturuuu admin recovery links for blocked scheduler status checks", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock(() =>
			Promise.resolve(
				Response.json(
					{
						adminRecoveryHref:
							"https://tuturuuu.com/vi/internal/infrastructure/monitoring/cron?focus=cron-runner",
						adminRecoveryReason:
							"Managed cron database is unavailable. Set a private platform database URL for Tuturuuu, then retry.",
						code: "MANAGED_CRON_DATABASE_UNAVAILABLE",
						configured: false,
						enabled: false,
						error: "Managed cron database is unavailable. Set a private platform database URL for Tuturuuu, then retry.",
						jobs: [],
						setupDisabledReason:
							"Managed cron database is unavailable. Set a private platform database URL for Tuturuuu, then retry.",
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
			adminRecoveryHref:
				"https://tuturuuu.com/vi/internal/infrastructure/monitoring/cron?focus=cron-runner",
			adminRecoveryReason:
				"Managed cron database is unavailable. Set a private platform database URL for Tuturuuu, then retry.",
			code: "MANAGED_CRON_DATABASE_UNAVAILABLE",
			setupDisabled: true,
		});
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
			setupDisabled: false,
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
			setupDisabled: false,
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
			setupDisabled: false,
		});
		const approvalUrl = new URL(String(body.approvalHref));
		expect(approvalUrl.pathname).toContain(
			"/internal/infrastructure/external-apps/approve",
		);
		expect(approvalUrl.searchParams.get("returnUrl")).toContain(
			"cronSetup=retry",
		);
	});

	test("returns actionable setup approval state when scheduler setup requires review", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock((url: string | URL, init?: RequestInit) => {
			expect(new URL(String(url)).pathname).toBe(
				"/api/v1/workspaces/workspace-1/external-apps/cron/setup",
			);
			expect(init?.method).toBe("POST");
			return Promise.resolve(
				Response.json(
					{
						code: "MANAGED_CRON_DOMAIN_NOT_APPROVED",
						message: "Managed scheduler domain requires review.",
						secret: "raw-secret",
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
			code: "MANAGED_CRON_DOMAIN_NOT_APPROVED",
			configured: false,
			enabled: false,
			error: "Managed scheduler domain requires review.",
			setupDisabled: false,
		});
		const approvalUrl = new URL(String(body.approvalHref));
		expect(approvalUrl.pathname).toContain(
			"/internal/infrastructure/external-apps/approve",
		);
		expect(approvalUrl.searchParams.get("returnUrl")).toContain(
			"cronSetup=retry",
		);
		expect(JSON.stringify(body)).not.toContain("raw-secret");
	});

	test("turns opaque upstream setup 403 responses into managed-cron approval links", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock((url: string | URL, init?: RequestInit) => {
			expect(new URL(String(url)).pathname).toBe(
				"/api/v1/workspaces/workspace-1/external-apps/cron/setup",
			);
			expect(init?.method).toBe("POST");
			return Promise.resolve(
				new Response("<html>Forbidden raw upstream body</html>", {
					headers: { "Content-Type": "text/html" },
					status: 403,
				}),
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
			setupDisabled: false,
			setupOrigin: "https://cybershield.example.com",
			upstreamStatus: 403,
		});
		const approvalUrl = new URL(String(body.approvalHref));
		expect(approvalUrl.searchParams.get("feature")).toBe("managed-cron");
		expect(approvalUrl.searchParams.get("origin")).toBe(
			"https://cybershield.example.com",
		);
		expect(JSON.stringify(body)).not.toContain("Forbidden raw upstream body");
		expect(JSON.stringify(body)).not.toContain("<html>");
	});

	test("keeps opaque upstream setup 404 responses blocked with a visible reason", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock(() =>
			Promise.resolve(
				new Response("<html>Missing route raw upstream body</html>", {
					headers: { "Content-Type": "text/html" },
					status: 404,
				}),
			),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const { POST } = await import("@/app/api/workspace/cron/setup/route");
		const response = await POST(
			request("/api/workspace/cron/setup", createSessionCookie(session())),
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(404);
		expect(body.approvalHref).toBeUndefined();
		expect(body).toMatchObject({
			adminRecoveryHref:
				"https://tuturuuu.com/vi/internal/infrastructure/monitoring/cron?focus=cron-runner",
			configured: false,
			enabled: false,
			localStorageReady: true,
			setupDisabled: true,
			upstreamStatus: 404,
		});
		expect(String(body.error)).toContain("HTTP 404");
		expect(String(body.setupDisabledReason)).toContain("HTTP 404");
		expect(JSON.stringify(body)).not.toContain("Missing route raw upstream body");
		expect(JSON.stringify(body)).not.toContain("<html>");
	});

	test("keeps opaque upstream setup 500 responses blocked with a visible reason", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock(() =>
			Promise.resolve(
				new Response("upstream stack trace raw body", {
					headers: { "Content-Type": "text/plain" },
					status: 500,
				}),
			),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const { POST } = await import("@/app/api/workspace/cron/setup/route");
		const response = await POST(
			request("/api/workspace/cron/setup", createSessionCookie(session())),
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(500);
		expect(body.approvalHref).toBeUndefined();
		expect(body).toMatchObject({
			configured: false,
			enabled: false,
			localStorageReady: true,
			setupDisabled: true,
			upstreamStatus: 500,
		});
		expect(String(body.error)).toContain("HTTP 500");
		expect(String(body.setupDisabledReason)).toContain("HTTP 500");
		expect(JSON.stringify(body)).not.toContain("stack trace raw body");
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

	test("preserves schedule timezone and overdue diagnostics from scheduler status", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock(() =>
			Promise.resolve(
				Response.json({
					configured: true,
					enabled: true,
					generatedAt: "2026-06-29T11:41:00.000Z",
					jobs: [
						{
							active: true,
							failureCount: 0,
							isOverdue: true,
							jobId: "job-1",
							jobKey: "process-queue",
							lastExecution: {
								durationMs: 123,
								id: "execution-1",
								jobKey: "process-queue",
								source: "scheduled",
								startedAt: "2026-06-29T11:25:00.000Z",
								status: "success",
							},
							lastRunAt: "2026-06-29T11:25:00.000Z",
							lastStatus: "success",
							name: "Managed scheduler process queue",
							nextRunAt: "2026-06-29T11:30:00.000Z",
							overdueReason:
								"No execution recorded after scheduled time.",
							overdueSince: "2026-06-29T11:30:00.000Z",
							schedule: "*/5 * * * *",
							scheduleDescription: "Every 5 minutes (Asia/Ho_Chi_Minh)",
							scheduleTimezone: "Asia/Ho_Chi_Minh",
						},
					],
					serverNow: "2026-06-29T11:41:00.000Z",
				}),
			),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const { GET } = await import("@/app/api/workspace/cron/route");
		const response = await GET(
			request("/api/workspace/cron", createSessionCookie(session())),
		);
		const body = (await response.json()) as Record<string, unknown>;
		const [job] = body.jobs as Array<Record<string, unknown>>;

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			generatedAt: "2026-06-29T11:41:00.000Z",
			serverNow: "2026-06-29T11:41:00.000Z",
		});
		expect(job).toMatchObject({
			isOverdue: true,
			overdueReason: "No execution recorded after scheduled time.",
			scheduleTimezone: "Asia/Ho_Chi_Minh",
		});
		expect(job.lastExecution).toMatchObject({
			id: "execution-1",
			source: "scheduled",
			status: "success",
		});
	});

	test("proxies managed scheduler schedule edits", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock((url: string | URL, init?: RequestInit) => {
			expect(new URL(String(url)).pathname).toBe(
				"/api/v1/workspaces/workspace-1/external-apps/cron/jobs/process-queue",
			);
			expect(init?.method).toBe("PATCH");
			expect(JSON.parse(String(init?.body))).toEqual({
				schedule: "0 9 * * *",
				scheduleTimezone: "Asia/Ho_Chi_Minh",
			});
			return Promise.resolve(Response.json({ ok: true }));
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const { PATCH } = await import(
			"@/app/api/workspace/cron/jobs/[jobKey]/route"
		);
		const response = await PATCH(
			new Request("https://cybershield.example.com/api/workspace/cron/jobs/process-queue", {
				body: JSON.stringify({
					schedule: "0 9 * * *",
					scheduleTimezone: "Asia/Ho_Chi_Minh",
				}),
				headers: { cookie: createSessionCookie(session()) },
				method: "PATCH",
			}),
			{ params: Promise.resolve({ jobKey: "process-queue" }) },
		);

		expect(response.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("proxies managed scheduler execution history", async () => {
		dbMode.missingStorage = false;
		const fetchMock = mock((url: string | URL, init?: RequestInit) => {
			const parsed = new URL(String(url));
			expect(parsed.pathname).toBe(
				"/api/v1/workspaces/workspace-1/external-apps/cron/jobs/process-queue/executions",
			);
			expect(parsed.searchParams.get("pageSize")).toBe("25");
			expect(init?.method).toBe("GET");
			return Promise.resolve(
				Response.json({
					items: [
						{
							durationMs: 321,
							id: "execution-1",
							jobKey: "process-queue",
							jobName: "Managed scheduler process queue",
							source: "manual",
							startedAt: "2026-06-29T11:40:00.000Z",
							status: "success",
						},
					],
					total: 1,
				}),
			);
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const { GET } = await import(
			"@/app/api/workspace/cron/jobs/[jobKey]/executions/route"
		);
		const response = await GET(
			new Request(
				"https://cybershield.example.com/api/workspace/cron/jobs/process-queue/executions?page=1&pageSize=25",
				{ headers: { cookie: createSessionCookie(session()) } },
			),
			{ params: Promise.resolve({ jobKey: "process-queue" }) },
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body).toMatchObject({ total: 1 });
		expect(body.items).toEqual([
			expect.objectContaining({
				id: "execution-1",
				source: "manual",
				status: "success",
			}),
		]);
	});
});
