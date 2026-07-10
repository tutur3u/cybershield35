import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { PATCH } from "@/app/api/auth/profile/route";
import { createAvatarUploadProof } from "@/lib/auth/avatar-upload-proof";
import {
	createSessionCookie,
	getRequestedScopes,
	readAdminSession,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function session(overrides: Partial<TuturuuuAdminSession> = {}): TuturuuuAdminSession {
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

function exchangeBody(updatedUser = {}) {
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
			avatarUrl: "https://example.com/new.png",
			displayName: "Updated Admin",
			email: "admin@example.com",
			id: "user-1",
			...updatedUser,
		},
		workspaceId: "workspace-1",
	};
}

function request(body: unknown, cookie?: string) {
	return new Request("https://cybershield.example.com/api/auth/profile", {
		body: JSON.stringify(body),
		headers: {
			"Content-Type": "application/json",
			...(cookie ? { cookie } : {}),
		},
		method: "PATCH",
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

describe("Tuturuuu profile proxy route", () => {
	test("rejects unauthenticated PATCH requests", async () => {
		const response = await PATCH(request({ display_name: "Updated Admin" }));

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "Authentication required",
		});
	});

	test("rejects browser-provided avatar URLs before forwarding to Tuturuuu", async () => {
		const cookie = createSessionCookie(session());
		const fetchMock = mock(() => Promise.resolve(new Response("{}")));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const response = await PATCH(
			request({ avatar_url: "https://example.com/new.png" }, cookie),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Invalid profile payload",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("forwards one PATCH and updates identity in the existing encrypted session", async () => {
		const cookie = createSessionCookie(session());
		const publicUrl = "https://storage.example.com/avatars/user-1/123.png";
		const uploadProof = createAvatarUploadProof({
			filePath: "user-1/123.png",
			publicUrl,
			userId: "user-1",
		});
		const fetchMock = mock((url: string | URL, init?: RequestInit) => {
			const pathname = new URL(String(url)).pathname;
			expect(pathname).toBe("/api/v1/users/me/profile");
			expect(init?.method).toBe("PATCH");
			const headers = new Headers(init?.headers);
			expect(headers.get("Authorization")).toBe("Bearer access-token");
			expect(headers.get("Content-Type")).toBe("application/json");
			expect(JSON.parse(String(init?.body))).toEqual({
				avatar_url: publicUrl,
				display_name: "Updated Admin",
			});
			return Promise.resolve(
				Response.json({ message: "Profile updated successfully" }),
			);
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const response = await PATCH(
			request(
				{
					avatar_upload: {
						public_url: publicUrl,
						upload_proof: uploadProof,
					},
					display_name: "  Updated Admin  ",
				},
				cookie,
			),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(await response.json()).toMatchObject({
			profile: {
				avatar_url: publicUrl,
				display_name: "Updated Admin",
			},
			session: {
				user: {
					avatarUrl: publicUrl,
					displayName: "Updated Admin",
				},
			},
		});
		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).toContain("cybershield35_admin_session=");
		expect(fetchMock).toHaveBeenCalledTimes(1);

		const refreshed = await readAdminSession(
			new Request("https://cybershield.example.com", {
				headers: { cookie: setCookie ?? "" },
			}),
		);
		expect(refreshed?.accessToken).toBe("access-token");
		expect(refreshed?.refreshToken).toBe("refresh-token");
		expect(refreshed?.user.avatarUrl).toBe(publicUrl);
		expect(refreshed?.user.displayName).toBe("Updated Admin");
	});

	test("refreshes a stale bearer once before one profile PATCH", async () => {
		const stale = session({
			expiresAt: new Date(Date.now() + 1000).toISOString(),
		});
		const calls: string[] = [];
		const fetchMock = mock((url: string | URL, init?: RequestInit) => {
			const pathname = new URL(String(url)).pathname;
			calls.push(pathname);
			if (pathname.endsWith("/auth/app-token/exchange")) {
				return Promise.resolve(Response.json(exchangeBody()));
			}

			expect(pathname).toBe("/api/v1/users/me/profile");
			expect(new Headers(init?.headers).get("Authorization")).toBe(
				"Bearer new-access-token",
			);
			return Promise.resolve(
				Response.json({ message: "Profile updated successfully" }),
			);
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const response = await PATCH(
			request(
				{ display_name: "Updated Admin" },
				createSessionCookie(stale),
			),
		);

		expect(response.status).toBe(200);
		expect(calls).toEqual([
			"/api/v1/auth/app-token/exchange",
			"/api/v1/users/me/profile",
		]);
		const setCookie = response.headers.get("Set-Cookie");
		const refreshed = await readAdminSession(
			new Request("https://cybershield.example.com", {
				headers: { cookie: setCookie ?? "" },
			}),
		);
		expect(refreshed?.accessToken).toBe("new-access-token");
		expect(refreshed?.refreshToken).toBe("new-refresh-token");
		expect(refreshed?.user.displayName).toBe("Updated Admin");
	});

	test("passes through Tuturuuu profile errors without refreshing identity", async () => {
		const cookie = createSessionCookie(session());
		const fetchMock = mock(() =>
			Promise.resolve(
				Response.json({ message: "Missing required scope" }, { status: 403 }),
			),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const response = await PATCH(
			request({ display_name: "Updated Admin" }, cookie),
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			message: "Missing required scope",
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
