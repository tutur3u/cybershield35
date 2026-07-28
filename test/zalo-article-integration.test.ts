import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

beforeEach(() => {
	process.env = {
		...originalEnv,
		CYBERSHIELD35_PUBLIC_APP_URL: "https://cybershield35.example",
		ZALO_APP_ID: "zalo-app-id",
		ZALO_APP_SECRET: "zalo-app-secret",
		ZALO_OA_ENABLED: "true",
		ZALO_TOKEN_ENCRYPTION_KEY:
			"test-zalo-encryption-key-with-at-least-thirty-two-characters",
	};
});

afterEach(() => {
	process.env = { ...originalEnv };
	globalThis.fetch = originalFetch;
	mock.restore();
});

describe("Zalo OA security and article contract", () => {
	test("sanitizes database and provider failures before returning them", async () => {
		const { publicErrorMessage } = await import("@/lib/http/public-error");

		expect(
			publicErrorMessage(
				new Error('Failed query: select "access_token_encrypted" from "zalo_oa_connections"'),
				"Không thể tải kết nối Zalo OA.",
			),
		).toBe("Không thể tải kết nối Zalo OA.");
		expect(
			publicErrorMessage(
				new Error("Nội dung đã thay đổi. Hãy đồng bộ lại bản ẩn trước."),
				"Không thể đồng bộ Zalo.",
			),
		).toBe("Nội dung đã thay đổi. Hãy đồng bộ lại bản ẩn trước.");
	});

	test("enforces Zalo-safe article field limits", async () => {
		const { articleAiSchema, articleContentSchema } = await import(
			"@/lib/articles/schemas"
		);
		const base = {
			author: "CyberShield35",
			blocks: [{ content: "Nội dung tự nhiên.", id: "block-1", type: "text" }],
			commentsEnabled: true,
			coverUrl: "https://example.com/cover.jpg",
			description: "Mô tả rõ ràng.",
			title: "Tiêu đề",
		};

		expect(articleContentSchema.safeParse(base).success).toBe(true);
		expect(
			articleContentSchema.safeParse({ ...base, title: "x".repeat(151) }).success,
		).toBe(false);
		expect(
			articleContentSchema.safeParse({
				...base,
				description: "x".repeat(301),
			}).success,
		).toBe(false);
		expect(
			articleAiSchema.parse({
				action: "draft",
				editorialIntent: "counter_argument",
				model: "google/gemini-3.6-flash",
			}),
		).toMatchObject({
			editorialIntent: "counter_argument",
			model: "google/gemini-3.6-flash",
		});
	});

	test("encrypts provider tokens without preserving plaintext", async () => {
		const { decryptZaloSecret, encryptZaloSecret } = await import(
			"@/lib/zalo/crypto"
		);
		const encrypted = encryptZaloSecret("sensitive-zalo-token");

		expect(encrypted).not.toContain("sensitive-zalo-token");
		expect(decryptZaloSecret(encrypted)).toBe("sensitive-zalo-token");
	});

	test("builds an OAuth v4 PKCE request and binds state to the actor", async () => {
		const { buildZaloAuthorizationUrl } = await import("@/lib/zalo/client");
		const {
			createZaloOauthState,
			readZaloOauthState,
			zaloOauthCookie,
		} = await import("@/lib/zalo/oauth-state");
		const oauth = createZaloOauthState({
			actorUserId: "user-1",
			redirectUri:
				"https://cybershield35.example/api/integrations/zalo/callback",
		});
		const authorizationUrl = new URL(
			buildZaloAuthorizationUrl({
				codeChallenge: oauth.codeChallenge,
				redirectUri: oauth.payload.redirectUri,
				state: oauth.payload.state,
			}),
		);
		const cookie = zaloOauthCookie(
			oauth.cookieValue,
			"https://cybershield35.example",
		).split(";")[0];
		const pending = readZaloOauthState(
			new Request(
				"https://cybershield35.example/api/integrations/zalo/callback",
				{ headers: { cookie } },
			),
			"user-1",
		);

		expect(authorizationUrl.origin).toBe("https://oauth.zaloapp.com");
		expect(authorizationUrl.searchParams.get("app_id")).toBe("zalo-app-id");
		expect(authorizationUrl.searchParams.get("code_challenge")).toBe(
			oauth.codeChallenge,
		);
		expect(pending.state).toBe(oauth.payload.state);
		expect(() =>
			readZaloOauthState(
				new Request(
					"https://cybershield35.example/api/integrations/zalo/callback",
					{ headers: { cookie } },
				),
				"another-user",
			),
		).toThrow();
	});

	test("exchanges a single-use code using the server-only secret header", async () => {
		const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
		globalThis.fetch = mock(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				calls.push({ input, init });
				return Response.json({
					access_token: "access-token",
					expires_in: 90_000,
					refresh_token: "rotating-refresh-token",
				});
			},
		) as unknown as typeof fetch;
		const { exchangeZaloAuthorizationCode } = await import("@/lib/zalo/client");
		const result = await exchangeZaloAuthorizationCode({
			code: "single-use-code",
			codeVerifier: "pkce-verifier",
			redirectUri:
				"https://cybershield35.example/api/integrations/zalo/callback",
		});
		const headers = new Headers(calls[0]?.init?.headers);
		const body = new URLSearchParams(String(calls[0]?.init?.body));

		expect(String(calls[0]?.input)).toContain("/v4/oa/access_token");
		expect(headers.get("secret_key")).toBe("zalo-app-secret");
		expect(body.get("grant_type")).toBe("authorization_code");
		expect(body.get("code_verifier")).toBe("pkce-verifier");
		expect(result.refreshToken).toBe("rotating-refresh-token");
	});

	test("creates an article hidden and verifies the asynchronous operation", async () => {
		const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
		globalThis.fetch = mock(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				calls.push({ input, init });
				return calls.length === 1
					? Response.json({ data: { token: "operation-token" }, error: 0 })
					: Response.json({ data: { id: "remote-article-id" }, error: 0 });
			},
		) as unknown as typeof fetch;
		const { createZaloArticle, verifyZaloArticleOperation } = await import(
			"@/lib/zalo/client"
		);
		const operation = await createZaloArticle("access-token", {
			author: "CyberShield35",
			blocks: [
				{
					content: "Nội dung tiếng Việt tự nhiên.",
					id: "block-1",
					type: "text",
				},
				{
					caption: "Ảnh minh họa",
					id: "block-2",
					type: "image",
					url: "https://example.com/body.jpg",
				},
			],
			commentsEnabled: true,
			coverUrl: "https://example.com/cover.jpg",
			description: "Mô tả bài viết.",
			status: "hide",
			title: "Tiêu đề bài viết",
		});
		const verified = await verifyZaloArticleOperation(
			"access-token",
			operation.token,
		);
		const createBody = JSON.parse(String(calls[0]?.init?.body));

		expect(createBody.status).toBe("hide");
		expect(createBody.type).toBe("normal");
		expect(createBody.cover.photo_url).toBe(
			"https://example.com/cover.jpg",
		);
		expect(createBody.cover.cover_type).toBe("photo");
		expect(createBody.cover.status).toBe("show");
		expect(createBody.body[1]).toEqual({
			caption: "Ảnh minh họa",
			type: "image",
			url: "https://example.com/body.jpg",
		});
		expect(verified.id).toBe("remote-article-id");
	});

	test("removes a hidden Zalo article through the official CRUD endpoint", async () => {
		const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
		globalThis.fetch = mock(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				calls.push({ input, init });
				return Response.json({ error: 0, message: "Success" });
			},
		) as unknown as typeof fetch;
		const { removeZaloArticle } = await import("@/lib/zalo/client");

		await removeZaloArticle("access-token", "hidden-article-id");

		expect(String(calls[0]?.input)).toContain("/v2.0/article/remove");
		expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
			id: "hidden-article-id",
		});
	});

	test("updates a verified hidden article to public only through an explicit show operation", async () => {
		const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
		globalThis.fetch = mock(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				calls.push({ input, init });
				return calls.length === 1
					? Response.json({
							data: { token: "publish-operation-token" },
							error: 0,
						})
					: Response.json({
							data: { id: "remote-article-id" },
							error: 0,
						});
			},
		) as unknown as typeof fetch;
		const { updateZaloArticle, verifyZaloArticleOperation } = await import(
			"@/lib/zalo/client"
		);

		const operation = await updateZaloArticle(
			"access-token",
			"remote-article-id",
			{
				author: "CyberShield35",
				blocks: [
					{
						content: "Bài viết đã được duyệt để xuất bản.",
						id: "block-1",
						type: "text",
					},
				],
				commentsEnabled: true,
				coverUrl: "https://example.com/cover.jpg",
				description: "Mô tả đã duyệt.",
				status: "show",
				title: "Tiêu đề đã duyệt",
			},
		);
		const verified = await verifyZaloArticleOperation(
			"access-token",
			operation.token,
		);
		const updateBody = JSON.parse(String(calls[0]?.init?.body));

		expect(String(calls[0]?.input)).toContain("/v2.0/article/update");
		expect(updateBody).toMatchObject({
			id: "remote-article-id",
			status: "show",
		});
		expect(operation.token).toBe("publish-operation-token");
		expect(verified.id).toBe("remote-article-id");
	});
});
