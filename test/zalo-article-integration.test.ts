import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
	reconcilePublicationOnReview,
	visiblePublicationError,
} from "@/lib/articles/publication-reconcile";

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
	test("keeps review and publishing actions inside the canonical editor", () => {
		const shared = readFileSync(
			"components/dashboard/article-editor/shared.tsx",
			"utf8",
		);
		const header = readFileSync(
			"components/dashboard/article-editor/editor-header.tsx",
			"utf8",
		);
		const rail = readFileSync(
			"components/dashboard/article-editor/publish-rail.tsx",
			"utf8",
		);
		const preview = readFileSync(
			"components/dashboard/article-editor/zalo-preview.tsx",
			"utf8",
		);

		expect(shared).toContain(
			'const ZALO_OA_MANAGER_URL = "https://oa.zalo.me/manage/content/article/"',
		);
		expect(preview).toContain("Mở trong Zalo OA");
		expect(preview).toContain('target="_blank"');
		expect(preview).toContain('rel="noopener noreferrer"');
		expect(preview).toContain("if (!remoteArticleId)");
		expect(header).toContain("Phê duyệt");
		expect(header).toContain("Zalo OA");
		expect(rail).toContain('article.reviewStatus !== "approved"');
	});

	test("keeps Zalo import outside the server-driven canonical article list", () => {
		const workspace = readFileSync(
			"components/dashboard/articles-workspace.tsx",
			"utf8",
		);

		expect(workspace).toContain("Nhập từ Zalo OA");
		expect(workspace).toContain("/api/articles/import-zalo");
		expect(workspace).toContain("Trạng thái duyệt");
		expect(workspace).toContain("Trạng thái đăng");
		expect(workspace).not.toContain("Chọn tất cả bài CS35 đang hiển thị");
		expect(workspace).not.toContain("Đồng bộ bản nháp ẩn");
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

		expect(workspace).toContain('articleCatalogInfiniteQueryOptions("local", 12, filters)');
		expect(workspace).toContain('articleCatalogInfiniteQueryOptions("zalo", 10)');
		expect(workspace).toContain("IntersectionObserver");
		expect(workspace).toContain("Đang tải thêm");
		expect(clientQueries).toContain("infiniteQueryOptions");
		expect(clientQueries).toContain("getNextPageParam");
		expect(clientQueries).toContain(
			'staleTime: scope === "zalo" ? 15 * 60_000 : 5 * 60_000',
		);
		expect(route).toContain("getCachedArticlesPage");
		expect(route).toContain("getCachedZaloArticleCatalogPage");
		expect(route).toContain("nextCursor");
		expect(store).toContain(".limit(limit + 1)");
		expect(zaloCatalog).toContain("listAccountArticlesPage");
		expect(zaloCatalog).toContain('"use cache"');
		expect(zaloCatalog).toContain("cacheTag(ZALO_ARTICLE_CATALOG_TAG)");
		expect(readFileSync("app/articles/page.tsx", "utf8")).toContain(
			"<HydrationBoundary",
		);
		expect(store).toContain('"use cache"');
		expect(store).toContain(
			"cacheLife({ expire: 300, revalidate: 30, stale: 30 })",
		);
		expect(store).toContain("cacheTag(ARTICLE_CATALOG_TAG)");
		expect(store).toContain('revalidateTag(ARTICLE_CATALOG_TAG, "max")');
	});

	test("removes successfully deleted local and Zalo rows from the client cache", async () => {
		const { removeDeletedArticlesFromCatalog } = await import(
			"@/lib/articles/client-queries"
		);
		const localArticle = {
			article: {
				coverUrl: null,
				createdAt: "2026-08-02T00:00:00.000Z",
				description: "Temporary article",
				id: "local-delete-id",
				originDraftId: null,
				publicationStatus: "hidden",
				state: "draft",
				remoteArticleId: "remote-delete-id",
				reviewStatus: "draft",
				scheduledAt: null,
				title: "Delete me",
				updatedAt: "2026-08-02T00:00:00.000Z",
			},
			oaDisplayName: "Test OA",
			oaId: "test-oa",
		};
		const remoteArticle = {
			author: "CS35",
			createdAt: null,
			coverUrl: null,
			description: "Temporary remote article",
			metrics: { comments: 0, likes: 0, shares: 0, views: 0 },
			oaConnectionId: "connection-id",
			oaDisplayName: "Test OA",
			oaId: "test-oa",
			publishedAt: null,
			publicationStatus: "remote_draft" as const,
			remoteArticleId: "remote-delete-id",
			title: "Delete me",
			updatedAt: null,
		};
		const result = removeDeletedArticlesFromCatalog(
			{
				pageParams: [null],
				pages: [
					{
						articles: [localArticle],
						hasNextPage: false,
						nextCursor: null,
						zaloArticles: [remoteArticle],
						zaloIssues: [],
					},
				],
			},
			{
				articleIds: new Set(["local-delete-id"]),
				remoteArticleIds: new Set(["remote-delete-id"]),
			},
		);

		expect(result?.pages[0]?.articles).toEqual([]);
		expect(result?.pages[0]?.zaloArticles).toEqual([]);
	});

	test("removes automatic draft synchronization and gates all Zalo operations", () => {
		const automation = readFileSync("lib/articles/automation.ts", "utf8");
		const schema = readFileSync("lib/db/schema.ts", "utf8");
		const policy = readFileSync("lib/articles/publication-policy.ts", "utf8");
		const publications = readFileSync(
			"lib/workers/article-publications.ts",
			"utf8",
		);

		expect(schema).toContain('autoSyncDrafts: boolean("auto_sync_drafts")');
		expect(schema).toContain(".default(false)");
		expect(automation).toContain('zaloStatus: "awaiting_explicit_approval"');
		expect(automation).not.toContain('"sync_hidden"');
		expect(policy).toContain('return reviewStatus === "approved"');
		expect(publications).toContain(
			'validateOperation(article, "hide", new Date(), actor.id)',
		);
		expect(publications).toContain('status: "cancelled"');
		expect(publications).toContain('eq(articlePublicationJobs.status, "running")');
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

describe("a request the rules reject is not a publish failure", () => {
	const worker = readFileSync(
		new URL("../lib/workers/article-publications.ts", import.meta.url),
		"utf8",
	);

	test("policy refusals are cancelled rather than retried", () => {
		// The queue held sync jobs from before the approval gate existed. Each run
		// re-ran one, the gate refused it, and the refusal was written back as a
		// publish failure — repainting an unapproved article red every few
		// minutes for work nobody had asked for.
		expect(worker).toContain("class PublicationNotPermittedError");
		expect(worker).toContain(
			"const notPermitted = error instanceof PublicationNotPermittedError",
		);
		expect(worker).toContain(
			"const retry = !notPermitted && claimed.attempts < claimed.maxAttempts",
		);
		expect(worker).toContain('notPermitted ? "cancelled" : "failed"');
	});

	test("every approval-shaped refusal uses that error", () => {
		// A plain Error here would be retried and reported as a Zalo failure.
		for (const message of [
			"Bài viết phải được phê duyệt trước mọi thao tác với Zalo OA.",
			"Tự động hóa chỉ được đồng bộ bản nháp ẩn; không được phép xuất bản công khai.",
			"Hãy bấm Xuất bản trong trình biên tập trước khi đưa bài lên Zalo OA.",
		]) {
			const at = worker.indexOf(message);
			expect(at).toBeGreaterThan(-1);
			expect(worker.slice(Math.max(0, at - 200), at)).toContain(
				"new PublicationNotPermittedError(",
			);
		}
	});

	test("a refused article keeps describing where it actually stands", () => {
		expect(worker).toContain('? "hidden"');
		expect(worker).toContain(': "not_synced",');
		expect(worker).toContain("if (!retry && !notPermitted) throw error;");
	});
});

describe("a review decision clears a refusal it inherited", () => {
	const base = {
		lastError: "Bài viết phải được phê duyệt trước mọi thao tác với Zalo OA.",
		remoteArticleId: null,
		reviewStatus: "needs_review",
	};

	test("stale intent is cleared, and the error with it", () => {
		// Otherwise the approver is greeted by "Đăng lỗi" describing a publish
		// that the approval gate itself refused before anything reached Zalo.
		for (const publicationStatus of [
			"failed",
			"syncing",
			"publishing",
			"scheduled",
		]) {
			expect(
				reconcilePublicationOnReview({ ...base, publicationStatus }),
			).toEqual({ lastError: null, publicationStatus: "not_synced" });
		}
	});

	test("an article with a draft on the OA keeps saying so", () => {
		expect(
			reconcilePublicationOnReview({
				...base,
				publicationStatus: "failed",
				remoteArticleId: "abc123",
			}),
		).toEqual({ lastError: null, publicationStatus: "hidden" });
	});

	test("nothing else is touched", () => {
		// An approved article's failure is real; a status that already describes
		// Zalo is not intent to be cleared.
		expect(
			reconcilePublicationOnReview({
				...base,
				publicationStatus: "failed",
				reviewStatus: "approved",
			}),
		).toBeNull();
		// A status that already describes Zalo is left alone; only the inherited
		// error goes with the decision.
		for (const publicationStatus of ["not_synced", "hidden", "published"]) {
			expect(
				reconcilePublicationOnReview({ ...base, publicationStatus }),
			).toEqual({ lastError: null });
			expect(
				reconcilePublicationOnReview({
					...base,
					lastError: null,
					publicationStatus,
				}),
			).toBeNull();
		}
	});

	test("the refusal is cleared even when the status was already right", () => {
		// The red banner is the stored error, not the status, so clearing only the
		// status would leave the warning on screen.
		expect(
			reconcilePublicationOnReview({ ...base, publicationStatus: "not_synced" }),
		).toEqual({ lastError: null });
	});

	test("an unapproved article never shows a publish error", () => {
		// Only an approved article can have had a publish attempted; anything else
		// is the approval gate's own refusal, shown beside the button that would
		// have asked for the publish in the first place.
		expect(
			visiblePublicationError({
				lastError: "Bài viết phải được phê duyệt trước mọi thao tác với Zalo OA.",
				reviewStatus: "needs_review",
			}),
		).toBeNull();
		expect(
			visiblePublicationError({
				lastError: "Zalo từ chối ảnh bìa.",
				reviewStatus: "approved",
			}),
		).toBe("Zalo từ chối ảnh bìa.");
	});

	test("every status it decides on is a real one", () => {
		// The first version of this wrote a SQL cast by hand, named an enum type
		// that does not exist, and broke approval outright — while a test that
		// matched the SQL as source text kept passing.
		const schema = readFileSync(
			new URL("../lib/db/schema.ts", import.meta.url),
			"utf8",
		);
		const declared = schema
			.slice(schema.indexOf("article_publication_status"))
			.slice(0, 300);
		for (const status of ["not_synced", "hidden", "failed", "syncing"]) {
			expect(declared).toContain(`"${status}"`);
		}
	});
});

describe("a pointer to a draft that is gone is not a warning", () => {
	const worker = readFileSync(
		new URL("../lib/workers/zalo-presence-reconciliation.ts", import.meta.url),
		"utf8",
	);

	test("nothing a follower can see is ever unlinked", () => {
		// Clearing a live article's pointer would strand it: CS35 would no longer
		// know which post on the OA it owns.
		expect(worker).toContain("notInArray(articles.publicationStatus, [");
		for (const status of ["published", "publishing", "scheduled"]) {
			expect(worker).toContain(`"${status}",`);
		}
	});

	test("the connection is proved healthy before absence is believed", () => {
		// The first version inferred an outage from "everything looks missing".
		// Then the OA was cleared by hand, every draft really was gone, and the
		// guard suppressed the truth — leaving six articles claiming to be on an
		// Official Account that held none of them.
		expect(worker).toContain("await listZaloArticles(accessToken, { limit: 1 })");
		expect(worker).not.toContain("missing.length === group.length");
		// A connection that cannot answer is skipped whole, not read as an OA
		// with nothing on it.
		expect(worker).toContain("skipped += group.length;");
	});

	test("clearing a pointer leaves the article re-syncable and audited", () => {
		expect(worker).toContain("remoteArticleId: null,");
		expect(worker).toContain("syncedContentHash: null,");
		expect(worker).toContain('publicationStatus: "not_synced",');
		expect(worker).toContain('action: "article_remote_pointer_cleared",');
	});
});

describe("the primary action says what the next step is", () => {
	const header = readFileSync(
		new URL("../components/dashboard/article-editor/editor-header.tsx", import.meta.url),
		"utf8",
	);

	test("a draft already on the OA is offered publishing, not another upload", () => {
		// The label used to come from the local publish target, so an article
		// already staged as hidden read "Đưa lên Zalo (ẩn)" — an action that would
		// change nothing, while the stepper above said the next step was going
		// public.
		expect(header).toContain("if (staged) {");
		expect(header).toContain("Hiển thị công khai");
		expect(header).toContain('onPublishAction("publish")');
		// Re-syncing is offered only when the OA copy is behind the editor.
		expect(header).toContain("{synced ? null : (");
		expect(header).toContain("Đồng bộ lại bản ẩn");
	});

	test("the staged branch is reached before the target-driven label", () => {
		expect(header.indexOf("if (staged) {")).toBeLessThan(
			header.indexOf("const blocked = blockers.length > 0;"),
		);
	});
});

describe("a presence check records what it saw", () => {
	const worker = readFileSync(
		new URL("../lib/workers/zalo-presence-reconciliation.ts", import.meta.url),
		"utf8",
	);

	test("checked and present is distinguishable from could not check", () => {
		// Otherwise "Zalo has it" and "we never asked" look identical afterwards —
		// which is the question when a draft cannot be found on the OA.
		expect(worker).toContain('action: "article_remote_presence_checked"');
		expect(worker).toContain("payload: result");
	});
});

describe("a sync recreates a draft that was deleted on the OA", () => {
	const worker = readFileSync(
		new URL("../lib/workers/article-publications.ts", import.meta.url),
		"utf8",
	);

	test("a dangling remote id becomes a create, not an update", () => {
		// Anyone with OA access can delete a draft and nothing tells us. Zalo
		// accepts an update against the deleted article and it verifies clean, so
		// the sync reported success while the OA still showed nothing.
		expect(worker).toContain('if (remoteArticleId && job.operation === "sync_hidden")');
		expect(worker).toContain("const stillThere = await getZaloArticle(");
		expect(worker).toContain("recreating = true;");
		expect(worker).toContain("remoteArticleId: null,");
	});

	test("a pending token cannot resurrect the deleted article instead", () => {
		// Resuming that operation would wait on an answer about something deleted
		// rather than making a new article.
		expect(worker).toContain(
			"if (!remoteArticleId && pendingToken && !recreating)",
		);
	});
});
