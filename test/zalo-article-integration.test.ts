import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";

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
	test("offers a secure handoff from synchronized articles to Zalo OA Manager", () => {
		const editor = readFileSync(
			"components/dashboard/article-editor.tsx",
			"utf8",
		);

		expect(editor).toContain(
			'const ZALO_OA_MANAGER_URL = "https://oa.zalo.me/manage/content/article/"',
		);
		expect(editor).toContain("Mở trong Zalo OA Manager");
		expect(editor).toContain("Mở trực tiếp danh sách Nội dung → Bài viết");
		expect(editor).toContain('target="_blank"');
		expect(editor).toContain('rel="noopener noreferrer"');
		expect(editor).toContain("if (!remoteArticleId)");
		expect(editor.indexOf("<ZaloDashboardHandoff")).toBeLessThan(
			editor.indexOf("!accounts.data?.enabled"),
		);
		expect(editor).toContain("const [railOpen, setRailOpen] = useState(false)");
		expect(editor).toContain("Mở bảng điều khiển Zalo");
	});

	test("keeps CS35 and Zalo-only articles distinct in one compact catalog", () => {
		const workspace = readFileSync(
			"components/dashboard/articles-workspace.tsx",
			"utf8",
		);

		expect(workspace).toContain("Created on CS35");
		expect(workspace).toContain("Zalo OA");
		expect(workspace).toContain("Bản nháp Zalo · chưa đăng");
		expect(workspace).toContain("localRemoteIds");
		expect(workspace).toContain("Lọc theo nguồn tạo bài");
		expect(workspace).toContain("Mới cập nhật trước");
		expect(workspace).toContain("Cũ cập nhật trước");
		expect(workspace).toContain("Sắp xếp theo tiêu đề");
		expect(workspace).toContain(
			'const ZALO_OA_MANAGER_URL = "https://oa.zalo.me/manage/content/article/"',
		);
		expect(workspace).toContain("Chọn tất cả bài CS35 đang hiển thị");
		expect(workspace).toContain("Đồng bộ bản nháp ẩn");
		expect(workspace).toContain("Bản nháp ẩn · chưa đăng");
	});

	test("loads the unified article catalog incrementally with a cached cursor", () => {
		const workspace = readFileSync(
			"components/dashboard/articles-workspace.tsx",
			"utf8",
		);
		const clientQueries = readFileSync(
			"lib/articles/client-queries.ts",
			"utf8",
		);
		const route = readFileSync("app/api/articles/route.ts", "utf8");
		const store = readFileSync("lib/articles/store.ts", "utf8");
		const zaloCatalog = readFileSync("lib/zalo/articles.ts", "utf8");

		expect(workspace).toContain(
			'articleCatalogInfiniteQueryOptions("local")',
		);
		expect(workspace).toContain(
			'articleCatalogInfiniteQueryOptions("zalo")',
		);
		expect(workspace).toContain("IntersectionObserver");
		expect(workspace).toContain("Tải thêm bài viết");
		expect(workspace).toContain("mergeArticlePages");
		expect(clientQueries).toContain("infiniteQueryOptions");
		expect(clientQueries).toContain("getNextPageParam");
		expect(clientQueries).toContain(
			'staleTime: scope === "zalo" ? 15 * 60_000 : 5 * 60_000',
		);
		expect(route).toContain("listArticlesPage");
		expect(route).toContain("getCachedZaloArticleCatalogPage");
		expect(route).toContain("nextCursor");
		expect(store).toContain(".limit(limit + 1)");
		expect(zaloCatalog).toContain("listAccountArticlesPage");
		expect(zaloCatalog).toContain('"use cache"');
		expect(zaloCatalog).toContain("cacheTag(ZALO_ARTICLE_CATALOG_TAG)");
		expect(readFileSync("app/articles/page.tsx", "utf8")).toContain(
			"<HydrationBoundary",
		);
	});

	test("keeps automatic scan articles hidden and configurable", () => {
		const automation = readFileSync("lib/articles/automation.ts", "utf8");
		const schema = readFileSync("lib/db/schema.ts", "utf8");
		const bulkRoute = readFileSync(
			"app/api/articles/bulk/route.ts",
			"utf8",
		);

		expect(schema).toContain('autoSyncDrafts: boolean("auto_sync_drafts")');
		expect(automation).toContain("!defaultOa.autoSyncDrafts");
		expect(automation).toContain('"sync_hidden"');
		expect(bulkRoute).toContain('"set_review_status"');
		expect(bulkRoute).toContain("removeRemoteArticle");
		expect(bulkRoute).not.toContain('"publish"');
	});

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
		});
		const headers = new Headers(calls[0]?.init?.headers);
		const body = new URLSearchParams(String(calls[0]?.init?.body));

		expect(String(calls[0]?.input)).toContain("/v4/oa/access_token");
		expect(headers.get("secret_key")).toBe("zalo-app-secret");
		expect(body.get("grant_type")).toBe("authorization_code");
		expect(body.get("code_verifier")).toBe("pkce-verifier");
		expect(body.has("redirect_uri")).toBe(false);
		expect(result.refreshToken).toBe("rotating-refresh-token");
	});

	test("treats a Zalo OAuth error body as a provider failure even with HTTP 200", async () => {
		globalThis.fetch = mock(async () =>
			Response.json({
				error: -14068,
				message: "OA permission was not granted.",
			}),
		) as unknown as typeof fetch;
		const { exchangeZaloAuthorizationCode } = await import("@/lib/zalo/client");

		await expect(
			exchangeZaloAuthorizationCode({
				code: "rejected-code",
				codeVerifier: "pkce-verifier",
			}),
		).rejects.toMatchObject({
			details: {
				error: -14068,
			},
			name: "ZaloApiError",
			status: 502,
		});
	});

	test("loads the OA profile through the current v2 contract", async () => {
		const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
		globalThis.fetch = mock(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				calls.push({ input, init });
				return Response.json({
					data: {
						avatar: "https://example.com/oa-avatar.jpg",
						name: "Công an phường Ea Kao",
						oaid: "2629920369363080604",
					},
					error: 0,
				});
			},
		) as unknown as typeof fetch;
		const { fetchZaloOaProfile } = await import("@/lib/zalo/client");

		const profile = await fetchZaloOaProfile(
			"access-token",
			"fallback-oa-id",
		);
		const headers = new Headers(calls[0]?.init?.headers);

		expect(String(calls[0]?.input)).toContain("/v2.0/oa/getoa");
		expect(headers.get("access_token")).toBe("access-token");
		expect(profile).toEqual({
			avatarUrl: "https://example.com/oa-avatar.jpg",
			displayName: "Công an phường Ea Kao",
			oaId: "2629920369363080604",
		});
	});

	test("normalizes the Zalo article catalog without confusing its origin", async () => {
		const {
			normalizeZaloArticleList,
			normalizeZaloPublicationStatus,
			zaloArticleListTotal,
		} = await import("@/lib/zalo/article-catalog");
		const payload = {
			data: {
				medias: [
					{
						create_date: 1_785_286_000,
						id: "zalo-article-1",
						status: "show",
						thumb: "https://example.com/zalo-cover.jpg",
						title: "Bài viết đã xuất bản",
						total_share: 5,
						total_view: "1.170",
					},
				],
				total: 12,
			},
			error: 0,
		};
		const articles = normalizeZaloArticleList(
			payload,
			{
				connectionId: "connection-1",
				displayName: "Công an phường Ea Kao",
				oaId: "2629920369363080604",
			},
		);

		expect(articles).toEqual([
			expect.objectContaining({
				coverUrl: "https://example.com/zalo-cover.jpg",
				metrics: {
					comments: 0,
					likes: 0,
					shares: 5,
					views: 1170,
				},
				oaDisplayName: "Công an phường Ea Kao",
				publicationStatus: "published",
				remoteArticleId: "zalo-article-1",
				title: "Bài viết đã xuất bản",
			}),
		]);
		expect(normalizeZaloPublicationStatus("draft")).toBe("remote_draft");
		expect(normalizeZaloPublicationStatus("hide")).toBe("hidden");
		expect(normalizeZaloPublicationStatus("rejected")).toBe("failed");
		expect(zaloArticleListTotal(payload)).toBe(12);
	});

	test("uses the supported Zalo page size when loading the article catalog", async () => {
		const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
		globalThis.fetch = mock(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				calls.push({ input, init });
				return Response.json({ data: { medias: [], total: 0 }, error: 0 });
			},
		) as unknown as typeof fetch;
		const { listZaloArticles } = await import("@/lib/zalo/client");

		await listZaloArticles("access-token", { limit: 20, offset: 10 });

		const requestUrl = new URL(String(calls[0]?.input));
		expect(requestUrl.searchParams.get("limit")).toBe("10");
		expect(requestUrl.searchParams.get("offset")).toBe("10");
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
