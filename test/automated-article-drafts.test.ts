import { describe, expect, test } from "bun:test";

import {
	buildAutomatedArticleSeed,
	normalizeAutomatedArticleContent,
} from "@/lib/articles/automation-content";
import {
	actorAllowsArticleOperation,
	reviewAllowsArticleOperation,
} from "@/lib/articles/publication-policy";

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

	test("keeps titles and excerpts separate and removes repeated headings", () => {
		const seed = buildAutomatedArticleSeed({
			body: "Nội dung gốc.",
			draftKind: "response",
			evidence: {
				metadata: {},
				quote: "Nội dung nguồn",
				summary:
					"📖 THÔNG CÁO BÁO CHÍ LỄ HỘI SẦU RIÊNG ĐẮK LẮK NĂM 2026\nLễ hội diễn ra từ 15/8 đến 02/9/2026 với nhiều hoạt động quảng bá nông sản và du lịch.",
			},
		});
		const content = normalizeAutomatedArticleContent(seed, {
			author: "CyberShield35",
			blocks: [
				{
					content:
						"📖 THÔNG CÁO BÁO CHÍ LỄ HỘI SẦU RIÊNG ĐẮK LẮK NĂM 2026\n\nLễ hội mang lại nhiều giá trị thiết thực [1].",
					id: "text-1",
					type: "text",
				},
			],
			commentsEnabled: true,
			coverUrl: null,
			description:
				"📖 THÔNG CÁO BÁO CHÍ LỄ HỘI SẦU RIÊNG ĐẮK LẮK NĂM 2026\nLễ hội diễn ra từ 15/8 đến 02/9/2026 với nhiều hoạt động quảng bá nông sản và du lịch.",
			reviewNotes: [],
			title:
				"📖 THÔNG CÁO BÁO CHÍ LỄ HỘI SẦU RIÊNG ĐẮK LẮK NĂM 2026 Lễ hội diễn ra từ 15/8 đến 02/9/2026 với chủ đề kết nối vươn xa",
		});

		expect(seed.title).toBe(
			"📖 THÔNG CÁO BÁO CHÍ LỄ HỘI SẦU RIÊNG ĐẮK LẮK NĂM 2026",
		);
		expect(content.title).toBe(seed.title);
		expect(content.description).toBe(
			"Lễ hội diễn ra từ 15/8 đến 02/9/2026 với nhiều hoạt động quảng bá nông sản và du lịch.",
		);
		expect(content.blocks[0]).toMatchObject({
			content: "Lễ hội mang lại nhiều giá trị thiết thực.",
		});
	});

	test("repairs punctuation variants and clipped description fragments", () => {
		const seed = buildAutomatedArticleSeed({
			body: "Nội dung gốc.",
			draftKind: "counter_argument",
			evidence: {
				metadata: {},
				quote: "Nội dung nguồn",
				summary:
					"🚨 RỬA TIỀN CHO LỪA ĐẢO LÀ CHUYỆN Ở ĐÂU XA?\nNgay tại Đắk Lắk, cơ quan chức năng đã khởi tố vụ án.",
			},
		});
		const content = normalizeAutomatedArticleContent(seed, {
			author: "CyberShield35",
			blocks: [
				{
					content:
						"🚨 RỬA TIỀN CHO LỪA ĐẢO LÀ CHUYỆN Ở ĐÂU XA?\n\nNhiều người th\n\nNhiều người thắc mắc vì sao dòng tiền khó thu hồi.",
					id: "text-1",
					type: "text",
				},
			],
			commentsEnabled: true,
			coverUrl: null,
			description:
				"🚨 RỬA TIỀN CHO LỪA ĐẢO LÀ CHUYỆN Ở ĐÂU XA?\nNgay tại Đắk Lắk, cơ quan chức năng đã khởi tố vụ án và 5 bị can trong đường dây rửa tiền xuyên quốc gia.\n\nNhiều người th",
			reviewNotes: [],
			title: "🚨 RỬA TIỀN CHO LỪA ĐẢO LÀ CHUYỆN Ở ĐÂU XA",
		});

		expect(content.description).toBe(
			"Ngay tại Đắk Lắk, cơ quan chức năng đã khởi tố vụ án và 5 bị can trong đường dây rửa tiền xuyên quốc gia.",
		);
		expect(content.blocks[0]).toMatchObject({
			content:
				"Nhiều người thắc mắc vì sao dòng tiền khó thu hồi.",
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
		expect(actorAllowsArticleOperation("system", "sync_hidden")).toBe(true);
		expect(actorAllowsArticleOperation("system", "publish")).toBe(false);
		expect(actorAllowsArticleOperation("system", "update_visible")).toBe(false);
		expect(actorAllowsArticleOperation("user-1", "publish")).toBe(true);
	});
});
