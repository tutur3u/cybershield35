import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { requireAdminSession } from "@/lib/auth/require-admin";
import {
	allowLocalAuthBypass,
	createSessionCookie,
	getRequestedScopes,
	getTuturuuuAuthDiagnostics,
	isTuturuuuAuthConfigured,
	readAdminSession,
	toSafeSession,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";

const originalEnv = { ...process.env };

function session(): TuturuuuAdminSession {
	return {
		accessToken: "ttr_app_access_secret",
		app: { name: "cybershield35" },
		createdAt: "2026-06-13T00:00:00.000Z",
		expiresAt: new Date(Date.now() + 60_000).toISOString(),
		expiresIn: 60,
		refreshEarlySeconds: 10,
		refreshExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
		refreshExpiresIn: 3600,
		refreshToken: "ttr_app_refresh_secret",
		tokenType: "Bearer",
		user: { displayName: "Admin Example", email: "admin@example.com", id: "user-1" },
		workspaceId: "workspace-1",
	};
}

beforeEach(() => {
	process.env.CYBERSHIELD35_SESSION_SECRET =
		"test-secret-for-cybershield35-session-cookie";
});

afterEach(() => {
	process.env = { ...originalEnv };
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
	});

	test("safe session strips bearer and refresh tokens", () => {
		const safe = toSafeSession(session());
		expect(JSON.stringify(safe)).not.toContain("ttr_app_access_secret");
		expect(JSON.stringify(safe)).not.toContain("ttr_app_refresh_secret");
		expect(JSON.stringify(safe)).not.toContain("workspace-1");
		expect(safe.user.displayName).toBe("Admin Example");
		expect(safe.user.email).toBe("admin@example.com");
	});

	test("auth configuration requires Tuturuuu production credentials", () => {
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "secret";
		expect(isTuturuuuAuthConfigured()).toBe(true);
	});

	test("requests the code-owned workspace session scope", () => {
		process.env.CYBERSHIELD35_REQUESTED_SCOPES =
			"external-projects:*,workspace:session";

		expect(getRequestedScopes()).toEqual(["workspace:session"]);
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

		expect(allowLocalAuthBypass(new Request("http://localhost:3000"))).toBe(true);
		expect(allowLocalAuthBypass(new Request("http://127.0.0.1:3000"))).toBe(true);
		expect(allowLocalAuthBypass(new Request("http://0.0.0.0:3000"))).toBe(true);
		expect(allowLocalAuthBypass(new Request("http://[::1]:3000"))).toBe(true);
		expect(allowLocalAuthBypass(new Request("http://app.example.com"))).toBe(false);

		process.env.NODE_ENV = "production";
		expect(allowLocalAuthBypass(new Request("http://localhost:3000"))).toBe(false);
	});

	test("local auth bypass is explicit", () => {
		process.env.NODE_ENV = "development";
		delete process.env.AUTH_LOCAL_BYPASS;

		expect(allowLocalAuthBypass(new Request("http://localhost:3000"))).toBe(false);
	});

	test("local auth bypass creates a local session only for dev localhost requests", async () => {
		process.env.AUTH_LOCAL_BYPASS = "true";
		process.env.NODE_ENV = "development";

		const local = await requireAdminSession(new Request("http://localhost:3000"));
		expect(local).toMatchObject({
			kind: "live",
			session: { user: { id: "local-dev" }, workspaceId: "local-dev" },
		});

		process.env.NODE_ENV = "production";
		const production = await requireAdminSession(
			new Request("http://localhost:3000"),
		);
		expect(production).toEqual({ error: "Authentication required", status: 401 });
	});
});
