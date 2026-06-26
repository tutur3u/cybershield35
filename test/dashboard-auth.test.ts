import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AuthRequiredScreen } from "@/components/dashboard/auth-required-screen";
import { resolveDashboardAuthFromRequest } from "@/lib/auth/dashboard-auth";
import {
	createSessionCookie,
	getTuturuuuAuthDiagnostics,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";
import { proxy } from "@/proxy";

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
			new NextRequest("https://cybershield.example.com/verify-token?token=short"),
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
			new NextRequest("https://cybershield.example.com/login?nextUrl=/sources", {
				headers: { cookie },
			}),
		);

		expect(protectedResponse.status).toBe(200);
		expect(protectedResponse.headers.get("location")).toBeNull();
		expect(loginResponse.status).toBe(307);
		expect(new URL(loginResponse.headers.get("location") ?? "").pathname).toBe(
			"/sources",
		);
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

	test("root layout redirects protected pages before rendering protected children", () => {
		const source = readFileSync("app/layout.tsx", "utf8");

		expect(source).toContain("resolveDashboardAuthFromCurrentRequest");
		expect(source).toContain("redirect(auth.loginPath)");
		expect(source).toContain("DashboardAuthProvider");
		expect(source).toContain("auth.authenticated");
		expect(source).toContain("auth.publicRoute");
		expect(source).toContain("{children}");
		expect(source).not.toContain("AuthRequiredScreen");
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

		expect(source).toContain("authDiagnostics.required");
		expect(source).toContain("statusLabel");
		expect(source).toContain("Đã cấu hình");
		expect(source).toContain("Sai cấu hình");
		expect(source).toContain("Thiếu");
		expect(source).toContain("loginHref");
		expect(source).toContain("Đăng nhập bằng Tuturuuu");
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
				loginHref: "https://tuturuuu.com/login?returnUrl=https%3A%2F%2Fcybershield.example.com%2Fverify-token",
			}),
		);

		expect(markup).toContain("Đăng nhập để tiếp tục");
		expect(markup).toContain("Đăng nhập bằng Tuturuuu");
		expect(markup).toContain("/brand-icons/tuturuuu.svg");
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
		expect(source).toContain("safePostLoginPath");
		expect(source).toContain("readAdminSession");
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
		const pages = readFileSync("components/dashboard/dashboard-pages.tsx", "utf8");
		const widgets = readFileSync("components/dashboard/page-widgets.tsx", "utf8");

		expect(shell).toContain("function AccountMenu");
		expect(shell).toContain("onRefreshAuth");
		expect(shell).toContain("onLogout");
		expect(shell).toContain("onSelectTheme");
		expect(shell).toContain("themeLabel");
		expect(shell).not.toContain("ThemeToggleButton");
		expect(pages).not.toContain("AuthSummary");
		expect(widgets).not.toContain("AuthSummary");
		expect(widgets).not.toContain("Tuturuuu server auth");
	});

	test("verify-token callback page completes login without manual token entry", () => {
		const page = readFileSync("app/verify-token/page.tsx", "utf8");
		const client = readFileSync("components/auth/verify-token-client.tsx", "utf8");

		expect(page).toContain("VerifyTokenClient");
		expect(client).toContain('searchParams.get("token")');
		expect(client).toContain('fetch("/api/auth/verify-app-token"');
		expect(client).toContain("router.replace(nextPath)");
		expect(client).toContain('href={retryHref}');
		expect(client).not.toContain("<input");
		expect(client).not.toContain("Dán token");
		expect(client).not.toContain("Short app token");
	});

	test("verify-token callback does not return to the dashboard without a token", () => {
		const client = readFileSync("components/auth/verify-token-client.tsx", "utf8");

		expect(client).toContain('if (!token) {');
		expect(client).toContain("setState(\"failed\")");
		expect(client).toContain("Phiên đăng nhập Tuturuuu không hợp lệ");
		expect(client).toContain("/login?nextUrl=");
		expect(client).not.toContain("if (!token) {\n\t\t\t\trouter.replace(nextPath)");
		expect(client).not.toContain("if (!token) {\n\t\t\t\trouter.refresh()");
		expect(client).not.toContain('href="/"');
	});

	test("dashboard client locks instead of rendering the app shell without auth", () => {
		const source = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);

		expect(source).toContain("if (!auth.authenticated)");
		expect(source).toContain(
			"<LockedDashboard error={auth.error} loginHref={auth.loginHref} />",
		);
		expect(source).toContain("function LockedDashboard");
		expect(source).toContain("href={loginHref}");
		expect(source).not.toContain('href="/"');
		expect(source).toContain("Đăng nhập để tiếp tục");
	});
});
