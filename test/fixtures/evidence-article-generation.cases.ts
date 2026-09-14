import { beforeEach, expect, mock, test } from "bun:test";
import type { ArticleAiOutput } from "@/lib/llm/schemas";

const id = "00000000-0000-4000-8000-000000000001";
const reads: unknown[][] = [];
const proposal: ArticleAiOutput = {
	author: "CyberShield35",
	title: "Lịch mở cửa thư viện",
	description:
		"Thư viện mở cửa sáng thứ Bảy để bạn đọc có thêm thời gian đọc sách.",
	blocks: [
		{
			id: "body",
			type: "text",
			content:
				"Thư viện mở cửa vào sáng thứ Bảy từ tuần tới.\n\nBạn đọc có thể sử dụng không gian học tập vào cuối tuần.",
		},
	],
	commentsEnabled: true,
	coverUrl: null,
	reviewNotes: [],
};
const createArticle = mock<(content: unknown, actor: unknown) => Promise<{ id: string }>>(async (content) => ({
	id,
	...(content as object),
}));
const setArticleReviewStatus = mock<(id: string, status: string, actor: unknown) => Promise<void>>(
	async () => undefined,
);
const generateArticleRevision = mock<(input: unknown) => Promise<ArticleAiOutput>>(
	async () => proposal,
);
const requireAdminSession = mock<(request: Request) => Promise<unknown>>(
	async () => ({
		session: { accessToken: "test", workspaceId: "workspace" },
		kind: "live",
	}),
);
mock.module("server-only", () => ({}));
mock.module("@/lib/auth/require-admin", () => ({
	requireAdminSession,
	authHeaders: () => ({ "Cache-Control": "no-store" }),
}));
mock.module("@/lib/chat/http", () => ({
	actorFromAuth: () => ({ id: "user", name: "Tester" }),
}));
mock.module("@/lib/articles/store", () => ({
	getArticleDetail: async () => ({ article: { ...proposal, contentHash: "before" }, evidence: [evidence] }),
	createArticle,
	setArticleReviewStatus,
}));
mock.module("@/lib/llm/generation", () => ({ generateArticleRevision }));
mock.module("@/lib/llm/text-fitting", () => ({
	fitArticleHeadline: async () => {
		throw new Error("Unexpected headline generation");
	},
}));
mock.module("@/lib/db/client", () => ({
	adminDb: {
		select: () => {
			const query = {
				from: () => query,
				where: () => query,
				limit: async () => reads.shift() ?? [],
			};
			return query;
		},
	},
}));
const { POST } = await import("@/app/api/evidence/[id]/article/route");
const evidence = {
	id,
	author: null,
	sourceUrl: "https://example.com/library",
	scanJobId: "scan",
	metadata: { originalImageUrl: "https://example.com/library.jpg" },
	quote:
		"Thư viện mở cửa sáng thứ Bảy. ".repeat(40) +
		"Thông tin quan trọng ở cuối nguồn.",
	summary: "Thư viện công bố lịch mở cửa mới.",
};
const request = (body = {}) =>
	new Request("https://example.com/api/evidence/test/article", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
beforeEach(() => {
	reads.length = 0;
	reads.push([evidence], []);
	createArticle.mockClear();
	setArticleReviewStatus.mockClear();
	generateArticleRevision.mockClear();
	generateArticleRevision.mockImplementation(async () => proposal);
	requireAdminSession.mockImplementation(async () => ({
		session: { accessToken: "test", workspaceId: "workspace" },
		kind: "live",
	}));
});

test("stores complete prose, original cover and evidence provenance, awaiting human review", async () => {
	const response = await POST(request(), { params: Promise.resolve({ id }) });
	expect(response.status).toBe(201);
	expect(await response.json()).toMatchObject({
		mode: "ai",
		href: `/articles/${id}`,
	});
	expect(createArticle).toHaveBeenCalledTimes(1);
	expect(createArticle.mock.calls[0]?.[0]).toMatchObject({
		blocks: proposal.blocks,
		coverUrl: evidence.metadata.originalImageUrl,
		originEvidenceItemId: id,
		originScanJobId: "scan",
	});
	expect(setArticleReviewStatus.mock.calls[0]?.[1]).toBe("needs_review");
	expect(generateArticleRevision.mock.calls[0]?.[0]).toMatchObject({
		evidence: [{ id, quote: evidence.quote, summary: evidence.summary }],
		content: { blocks: [] },
	});
});

test("provider failures are actionable errors with no article or review writes", async () => {
	generateArticleRevision.mockImplementation(async () => {
		throw new Error("Provider rejected secret request");
	});
	const response = await POST(request(), { params: Promise.resolve({ id }) });
	expect(response.status).toBe(502);
	const result = await response.json();
	expect(result.code).toBe("ARTICLE_GENERATION_FAILED");
	expect(result.error).toContain("Vui lòng thử lại");
	expect(result.error).not.toContain("secret");
	expect(createArticle).not.toHaveBeenCalled();
	expect(setArticleReviewStatus).not.toHaveBeenCalled();
});

test("post-normalization validation blocks empty or placeholder bodies", async () => {
	generateArticleRevision.mockImplementation(async () => ({
		...proposal,
		blocks: [
			{
				id: "body",
				type: "text",
				content:
					"Nội dung nguồn bị cắt\n\nPhần phân tích sẽ được biên tập viên hoàn thiện tại đây.",
			},
		],
	}));
	const response = await POST(request(), { params: Promise.resolve({ id }) });
	expect(response.status).toBe(502);
	expect(createArticle).not.toHaveBeenCalled();
});

test("an explicit request cannot bypass generation and save the old scaffold", async () => {
	const response = await POST(request({ useAi: false }), {
		params: Promise.resolve({ id }),
	});
	expect(response.status).toBe(400);
	expect(generateArticleRevision).not.toHaveBeenCalled();
	expect(createArticle).not.toHaveBeenCalled();
});

test("missing evidence and unauthenticated requests do not generate or save", async () => {
	reads.length = 0;
	expect(
		(await POST(request(), { params: Promise.resolve({ id }) })).status,
	).toBe(404);
	requireAdminSession.mockImplementation(async () => ({
		error: "Authentication required",
		status: 401,
	}));
	expect(
		(await POST(request(), { params: Promise.resolve({ id }) })).status,
	).toBe(401);
	expect(generateArticleRevision).not.toHaveBeenCalled();
	expect(createArticle).not.toHaveBeenCalled();
});


const { POST: reviseArticle } = await import("@/app/api/articles/[id]/ai/route");
for (const action of ["draft", "rewrite", "description"]) {
	test(`editor ${action} returns a complete proposal without saving or approving`, async () => {
		const response = await reviseArticle(request({ action }), { params: Promise.resolve({ id }) });
		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.proposal).toMatchObject(proposal);
		expect(result.summary.contentHashBefore).toBe("before");
		expect(createArticle).not.toHaveBeenCalled();
		expect(setArticleReviewStatus).not.toHaveBeenCalled();
	});
}

test("the editor excerpt shortcut discards unrelated model edits", async () => {
	generateArticleRevision.mockImplementation(async () => ({ ...proposal, title: "Unrequested change", blocks: [], description: "Trích yếu mới được viết thành câu hoàn chỉnh." }));
	const response = await reviseArticle(request({ action: "description" }), { params: Promise.resolve({ id }) });
	const result = await response.json();
	expect(response.status).toBe(200);
	expect(result.proposal.title).toBe(proposal.title);
	expect(result.proposal.blocks).toEqual(proposal.blocks);
	expect(result.proposal.description).toBe("Trích yếu mới được viết thành câu hoàn chỉnh.");
});

test("editor AI errors offer retry and never replace existing content", async () => {
	generateArticleRevision.mockImplementation(async () => { throw new Error("Provider error"); });
	const response = await reviseArticle(request({ action: "rewrite" }), { params: Promise.resolve({ id }) });
	expect(response.status).toBe(500);
	expect((await response.json()).error).toContain("Vui lòng thử lại");
	expect(createArticle).not.toHaveBeenCalled();
	expect(setArticleReviewStatus).not.toHaveBeenCalled();
});
