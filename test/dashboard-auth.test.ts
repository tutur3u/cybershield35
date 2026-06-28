import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { POST as verifyAppToken } from "@/app/api/auth/verify-app-token/route";
import { AuthRequiredScreen } from "@/components/dashboard/auth-required-screen";
import { LockedDashboard } from "@/components/dashboard/cybershield-dashboard";
import { resolveDashboardAuthFromRequest } from "@/lib/auth/dashboard-auth";
import {
	createSessionCookie,
	getRequestedScopes,
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

	test("returns a scope approval href for Tuturuuu scope-denied refreshes", async () => {
		process.env.NODE_ENV = "production";
		process.env.TUTURUUU_API_BASE_URL = "https://tuturuuu.com/api/v1";
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "workspace-1";
		process.env.CYBERSHIELD35_APP_ID = "cybershield35";
		process.env.CYBERSHIELD35_APP_SECRET = "app-secret";
		process.env.TUTURUUU_WEB_APP_URL = "https://tuturuuu.com";
		const staleSession = session();
		staleSession.expiresAt = new Date(Date.now() - 60_000).toISOString();
		const cookie = createSessionCookie(staleSession);
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (() =>
			Promise.resolve(
				Response.json(
					{ error: "Requested scope is not allowed for this app" },
					{ status: 403 },
				),
			)) as typeof fetch;

		try {
			const auth = await resolveDashboardAuthFromRequest(
				new Request("https://cybershield.example.com/sources?tab=facebook", {
					headers: { cookie },
				}),
			);

			if (auth.authenticated) throw new Error("Expected blocked request");
			expect(auth.status).toBe(403);
			expect(auth.error).toBe("Requested scope is not allowed for this app");
			expect(auth.scopeApprovalHref).toBeTruthy();
			const approvalUrl = new URL(auth.scopeApprovalHref ?? "");
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
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("root layout gates protected pages before rendering protected children", () => {
		const source = readFileSync("app/layout.tsx", "utf8");
		const dashboard = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);

		expect(source).toContain("resolveDashboardAuthFromCurrentRequest");
		expect(source).toContain("connection()");
		expect(source).toContain("DashboardAppSkeleton");
		expect(source).toContain("LockedDashboard");
		expect(source).toContain("DashboardLayoutShell");
		expect(source).toContain("<DashboardLayoutShell");
		expect(source).toContain("auth.authenticated");
		expect(source).toContain("auth.publicRoute");
		expect(source).toContain("{children}");
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
				loginHref:
					"https://tuturuuu.com/login?returnUrl=https%3A%2F%2Fcybershield.example.com%2Fverify-token",
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

	test("locked dashboard renders approval action only when provided", () => {
		const withoutApproval = renderToStaticMarkup(
			createElement(LockedDashboard, {
				error: "Requested scope is not allowed for this app",
				loginHref: "/login?nextUrl=%2Fsources",
			}),
		);
		expect(withoutApproval).toContain("Đăng nhập lại");
		expect(withoutApproval).not.toContain("Duyệt quyền truy cập");

		const withApproval = renderToStaticMarkup(
			createElement(LockedDashboard, {
				error: "Requested scope is not allowed for this app",
				loginHref: "/login?nextUrl=%2Fsources",
				scopeApprovalHref:
					"https://tuturuuu.com/vi/internal/infrastructure/external-apps/approve?appId=cybershield35",
			}),
		);
		expect(withApproval).toContain("Đăng nhập lại");
		expect(withApproval).toContain("Duyệt quyền truy cập");
		expect(withApproval).toContain(
			"https://tuturuuu.com/vi/internal/infrastructure/external-apps/approve?appId=cybershield35",
		);
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

	test("collapsed sidebar navigation uses tooltips from the layout shell", () => {
		const shell = readFileSync("components/dashboard/shell.tsx", "utf8");
		const layoutShell = readFileSync(
			"components/dashboard/dashboard-layout-shell.tsx",
			"utf8",
		);

		expect(shell).toContain("@tuturuuu/ui/tooltip");
		expect(shell).toContain("TooltipProvider");
		expect(shell).toContain("TooltipTrigger");
		expect(shell).toContain("TooltipContent");
		expect(shell).toContain("side=\"right\"");
		expect(shell).toContain("collapsed ? item.label : undefined");
		expect(layoutShell).toContain("<Sidebar");
		expect(layoutShell).toContain("<TopBar");
	});

	test("sidebar uses the CyberShield35 wordmark as the home link", () => {
		const shell = readFileSync("components/dashboard/shell.tsx", "utf8");

		expect(shell).toContain("CyberShield35");
		expect(shell).toContain("CS35");
		expect(shell).toContain("BrandmarkLink");
		expect(shell).toContain("BRANDMARK_IDLE_COLLAPSE_MS");
		expect(shell).toContain("BRANDMARK_RECOLLAPSE_DELAY_MS");
		expect(shell).toContain('import "slot-text/style.css"');
		expect(shell).toContain('import { SlotText } from "slot-text/react"');
		expect(shell).toContain('<SlotText');
		expect(shell).toContain('text={brandmarkText}');
		expect(shell).toContain("stagger: 28");
		expect(shell).toContain("leading-[1.35]");
		expect(shell).toContain("min-h-[1.35em]");
		expect(shell).toContain("[&_.char-slot]:leading-[1.45]");
		expect(shell).toContain("onPointerEnter");
		expect(shell).toContain("onPointerLeave");
		expect(shell).toContain('href="/"');
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
		expect(route).toContain("Authorization: auth.authorization");
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
		expect(dashboard).toContain("customReports");
		expect(dashboard).toContain("onCreateReport");
		expect(dashboard).toContain("onUpdateReport");
		expect(dashboard).toContain("onDeleteReport");
		expect(pages).toContain("onEditScan");
		expect(pages).toContain("onDeleteScan");
		expect(pages).toContain("onCreateEvidence");
		expect(pages).toContain("onEditEvidence");
		expect(pages).toContain("onDeleteEvidence");
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
		expect(appPage).toContain('page="members"');
		expect(page).toContain("workspaceMembersQueryOptions");
		expect(queries).toContain('fetchJson("/api/workspace/members")');
		expect(page).toContain("/api/workspace/members/invitations");
		expect(page).toContain("/api/workspace/members/default-admin");
		expect(page).toContain("confirmDefaultAdminDisable");
		expect(proxy).toContain("getBearerForPlatformRequest");
		expect(proxy).toContain("Authorization: auth.authorization");
		expect(proxy).not.toContain("CYBERSHIELD35_APP_SECRET");
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
		expect(layout).toContain("QueryProvider");
		expect(route).toContain("HydrationBoundary");
		expect(route).toContain("dehydrate(queryClient)");
		expect(dashboard).toContain("useQuery");
		expect(dashboard).toContain("invalidateQueries");
		expect(queryKeys).toContain("120_000");
		expect(initialRoute).toContain("getDashboardInitialData");
		expect(initialRoute).toContain("requireAdminSession");
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
		const pages = readFileSync(
			"components/dashboard/dashboard-pages.tsx",
			"utf8",
		);
		const dashboard = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);

		expect(runRoute).toContain("export async function POST");
		expect(runRoute).toContain("processScanJobNow");
		expect(actions).toContain("runScanRecord");
		expect(widgets).toContain("onRunScan");
		expect(widgets).toContain("aria-label=\"Chạy scan ngay\"");
		expect(pages).toContain("onRunScan");
		expect(dashboard).toContain("runScanRecord");
	});

	test("managed scheduler load failures disable setup and expose retry UI", () => {
		const panel = readFileSync(
			"components/dashboard/managed-scheduler-panel.tsx",
			"utf8",
		);
		const queries = readFileSync("lib/dashboard/client-queries.ts", "utf8");

		expect(queries).toContain("parseManagedSchedulerStatusResponse");
		expect(queries).not.toContain('return fetchJson("/api/workspace/cron")');
		expect(panel).toContain("queryUnavailable");
		expect(panel).toContain("query.refetch()");
		expect(panel).toContain("Không thể kiểm tra managed scheduler");
		expect(panel).toContain("disabled={controlsDisabled}");
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
		expect(client).toContain("href={retryHref}");
		expect(client).toContain("scopeApprovalHref");
		expect(client).toContain("Duyệt quyền truy cập");
		expect(client).not.toContain("<input");
		expect(client).not.toContain("Dán token");
		expect(client).not.toContain("Short app token");
	});

	test("auth provider branding stays on the login surface", () => {
		const loginPage = readFileSync("app/login/page.tsx", "utf8");
		const loginScreen = readFileSync(
			"components/dashboard/auth-required-screen.tsx",
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
		expect(client).toContain('setState("failed")');
		expect(client).toContain("Phiên đăng nhập không hợp lệ");
		expect(client).toContain("/login?nextUrl=");
		expect(client).not.toContain(
			"if (!token) {\n\t\t\t\trouter.replace(nextPath)",
		);
		expect(client).not.toContain("if (!token) {\n\t\t\t\trouter.refresh()");
		expect(client).not.toContain('href="/"');
	});

	test("dashboard client locks instead of rendering the app shell without auth", () => {
		const source = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);

		expect(source).toContain("if (!auth.authenticated)");
		expect(source).toContain("<LockedDashboard");
		expect(source).toContain("scopeApprovalHref={auth.scopeApprovalHref}");
		expect(source).toContain("Duyệt quyền truy cập");
		expect(source).toContain("export function LockedDashboard");
		expect(source).toContain("href={loginHref}");
		expect(source).not.toContain('href="/"');
		expect(source).toContain("Đăng nhập để tiếp tục");
	});
});
