import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	createSessionCookie,
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
		user: { email: "admin@example.com", id: "user-1" },
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
		expect(safe.user.email).toBe("admin@example.com");
	});

	test("auth configuration requires Tuturuuu production credentials", () => {
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "secret";
		expect(isTuturuuuAuthConfigured()).toBe(true);

		expect(isTuturuuuAuthConfigured()).toBe(true);
	});
});
