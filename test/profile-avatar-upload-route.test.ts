import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { POST } from "@/app/api/auth/profile/avatar/upload-url/route";
import {
	createSessionCookie,
	getRequestedScopes,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function session(): TuturuuuAdminSession {
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
			avatarUrl: null,
			displayName: "Admin Example",
			email: "admin@example.com",
			id: "user-1",
		},
		workspaceId: "workspace-1",
	};
}

function request(body: unknown, cookie?: string) {
	return new Request(
		"https://cybershield.example.com/api/auth/profile/avatar/upload-url",
		{
			body: JSON.stringify(body),
			headers: {
				"Content-Type": "application/json",
				...(cookie ? { cookie } : {}),
			},
			method: "POST",
		},
	);
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

describe("Tuturuuu avatar signed upload proxy", () => {
	test("rejects unauthenticated upload URL requests", async () => {
		const response = await POST(
			request({
				contentType: "image/png",
				filename: "avatar.png",
				size: 1024,
			}),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "Authentication required",
		});
	});

	test("rejects non-image media before calling Tuturuuu", async () => {
		const fetchMock = mock(() => Promise.resolve(new Response("{}")));
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		const cookie = createSessionCookie(session());

		const response = await POST(
			request(
				{
					contentType: "video/mp4",
					filename: "avatar.mp4",
					size: 1024,
				},
				cookie,
			),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Invalid avatar upload payload",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("forwards safe filename metadata and strips the separate Tuturuuu upload token", async () => {
		const cookie = createSessionCookie(session());
		const fetchMock = mock((url: string | URL, init?: RequestInit) => {
			expect(new URL(String(url)).pathname).toBe(
				"/api/v1/users/me/avatar/upload-url",
			);
			expect(init?.method).toBe("POST");
			const headers = new Headers(init?.headers);
			expect(headers.get("Authorization")).toBe("Bearer access-token");
			expect(headers.get("Content-Type")).toBe("application/json");
			expect(JSON.parse(String(init?.body))).toEqual({ filename: "avatar.png" });
			return Promise.resolve(
				Response.json({
					filePath: "user-1/123.png",
					publicUrl: "https://storage.example.com/avatars/user-1/123.png",
					token: "separate-upload-token",
					uploadUrl: "https://storage.example.com/sign/avatar-token",
				}),
			);
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const response = await POST(
			request(
				{
					contentType: "image/png",
					filename: "avatar.png",
					size: 1024,
				},
				cookie,
			),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		const body = await response.json();
		expect(body).toMatchObject({
			filePath: "user-1/123.png",
			publicUrl: "https://storage.example.com/avatars/user-1/123.png",
			uploadUrl: "https://storage.example.com/sign/avatar-token",
		});
		expect(typeof body.uploadProof).toBe("string");
		expect(JSON.stringify(body)).not.toContain("separate-upload-token");
	});
});
