import { describe, expect, test } from "bun:test";

import {
	buildAutomatedArticleSeed,
	normalizeAutomatedArticleContent,
} from "@/lib/articles/automation-content";
import { reviewAllowsArticleOperation } from "@/lib/articles/publication-policy";

describe("automated article draft preparation", () => {
	test("uses the scanned Facebook image and removes inline citation traces", () => {
		const seed = buildAutomatedArticleSeed({
			body: "Luận điểm này cần được kiểm chứng [1].\n\nBằng chứng hiện có cho thấy điều ngược lại 【2】.",
			draftKind: "counter_argument",
			evidence: {
				metadata: {
					originalImageUrl: "https://example.com/facebook-photo.jpg",
				},
				quote: "Nội dung nguồn",
				summary:
					"Thông tin đang được chia sẻ chưa phản ánh đầy đủ dữ kiện đã được xác minh.",
			},
		});

		expect(seed.coverUrl).toBe(
			"https://example.com/facebook-photo.jpg",
		);
		expect(seed.blocks[0]).toMatchObject({
			type: "text",
			content:
				"Luận điểm này cần được kiểm chứng.\n\nBằng chứng hiện có cho thấy điều ngược lại.",
		});
		expect(seed.title).not.toContain("[");
	});

	test("keeps the original scanned image when normalizing AI preparation", () => {
		const seed = buildAutomatedArticleSeed({
			body: "Nội dung gốc.",
			draftKind: "response",
			evidence: {
				metadata: {
					originalImageUrl: "https://example.com/original.jpg",
				},
				quote: "Nội dung nguồn",
				summary: "Một thông tin hữu ích đã được xác minh.",
			},
		});
		const content = normalizeAutomatedArticleContent(seed, {
			author: "CyberShield35",
			blocks: [
				{
					content: "Bản viết tự nhiên hơn [1].",
					id: "text-1",
					type: "text",
				},
			],
			commentsEnabled: true,
			coverUrl: null,
			description: "Mô tả rõ ràng.",
			reviewNotes: [],
			title: "Tiêu đề tự nhiên",
		});

		expect(content.coverUrl).toBe("https://example.com/original.jpg");
		expect(content.blocks[0]).toMatchObject({
			content: "Bản viết tự nhiên hơn.",
		});
	});

	test("allows hidden review drafts but protects every public operation", () => {
		expect(reviewAllowsArticleOperation("needs_review", "sync_hidden")).toBe(
			true,
		);
		expect(reviewAllowsArticleOperation("draft", "sync_hidden")).toBe(true);
		expect(reviewAllowsArticleOperation("rejected", "sync_hidden")).toBe(
			false,
		);
		expect(reviewAllowsArticleOperation("needs_review", "publish")).toBe(
			false,
		);
		expect(reviewAllowsArticleOperation("approved", "publish")).toBe(true);
	});
});
