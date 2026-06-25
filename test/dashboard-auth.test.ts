import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { resolveDashboardAuthFromRequest } from "@/lib/auth/dashboard-auth";
import {
	createSessionCookie,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";

const originalEnv = { ...process.env };

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
		tokenType: "Bearer",
		user: { email: "admin@example.com", id: "user-1" },
		workspaceId: "workspace-1",
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

	test("allows explicit localhost dev bypass", async () => {
		process.env.AUTH_LOCAL_BYPASS = "true";
		process.env.NODE_ENV = "development";

		const auth = await resolveDashboardAuthFromRequest(
			new Request("http://localhost:3000"),
		);

		expect(auth).toMatchObject({
			authenticated: true,
			session: { user: { id: "local-dev" }, workspaceId: "local-dev" },
		});
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
				user: { email: "admin@example.com", id: "user-1" },
				workspaceId: "workspace-1",
			},
		});
		expect(JSON.stringify(auth)).not.toContain("access-token");
		expect(JSON.stringify(auth)).not.toContain("refresh-token");
	});

	test("root layout gates app pages before rendering protected children", () => {
		const source = readFileSync("app/layout.tsx", "utf8");

		expect(source).toContain("resolveDashboardAuthFromCurrentRequest");
		expect(source).toContain("AuthRequiredScreen");
		expect(source).toContain("DashboardAuthProvider");
		expect(source).toContain("auth.authenticated");
		expect(source).toContain("{children}");
	});

	test("app pages do not own the route protection boundary", () => {
		for (const file of pageFiles()) {
			const source = readFileSync(file, "utf8");
			expect(source, file).not.toContain("ProtectedDashboard");
		}
	});

	test("unauthenticated screen gives admin setup instructions instead of token entry", () => {
		const source = readFileSync(
			"components/dashboard/auth-required-screen.tsx",
			"utf8",
		);

		for (const envName of [
			"TUTURUUU_API_BASE_URL",
			"TUTURUUU_CYBERSHIELD35_WORKSPACE_ID",
			"CYBERSHIELD35_APP_ID",
			"CYBERSHIELD35_APP_SECRET",
			"CYBERSHIELD35_SESSION_SECRET",
			"AUTH_LOCAL_BYPASS",
		]) {
			expect(source).toContain(envName);
		}

		expect(source).not.toContain('"use client"');
		expect(source).not.toContain("useRouter");
		expect(source).not.toContain("useState");
		expect(source).not.toContain("fetch(");
		expect(source).not.toContain("Short app token");
		expect(source).not.toContain("Dán token");
		expect(source).not.toContain("Xác thực Tuturuuu");
		expect(source).not.toContain("verify-app-token");
		expect(source).not.toContain("<input");
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
});
