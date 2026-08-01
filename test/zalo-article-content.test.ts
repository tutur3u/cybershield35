import { describe, expect, test } from "bun:test";

import {
	prepareZaloArticleContent,
	ZALO_EDITORIAL_DESCRIPTION_LIMIT,
	ZALO_EDITORIAL_TITLE_LIMIT,
} from "@/lib/zalo/article-content";

describe("Zalo article content preparation", () => {
	test("keeps the title, excerpt, and body as separate editorial fields", () => {
		const prepared = prepareZaloArticleContent({
			author: "CyberShield35",
			blocks: [
				{
					content:
						"📖 ĐẮK LẮK: KHẮC GHI CÔNG LAO CÁC ANH HÙNG LIỆT SĨ\n\nTrong không khí thiêng liêng của những ngày tháng Bảy, địa phương tổ chức hoạt động tri ân.\n\nViệc duy trì hoạt động này giúp thế hệ trẻ hiểu hơn về lịch sử.",
					id: "body",
					type: "text",
				},
			],
			commentsEnabled: true,
			coverUrl: null,
			description:
				"📖 ĐẮK LẮK: KHẮC GHI CÔNG LAO CÁC ANH HÙNG LIỆT SĨ\nTrong không khí thiêng liêng của những ngày tháng Bảy, địa phương tổ chức hoạt động tri ân.",
			title: "📖 ĐẮK LẮK: KHẮC GHI CÔNG LAO CÁC ANH HÙNG LIỆT SĨ",
		});

		expect(prepared.title).toBe(
			"ĐẮK LẮK: KHẮC GHI CÔNG LAO CÁC ANH HÙNG LIỆT SĨ",
		);
		expect(prepared.description).toBe(
			"Trong không khí thiêng liêng của những ngày tháng Bảy, địa phương tổ chức hoạt động tri ân.",
		);
		expect(prepared.blocks[0]).toMatchObject({
			content:
				"Trong không khí thiêng liêng của những ngày tháng Bảy, địa phương tổ chức hoạt động tri ân.\n\nViệc duy trì hoạt động này giúp thế hệ trẻ hiểu hơn về lịch sử.",
		});
	});

	test("uses conservative limits without cutting a word or sentence fragment", () => {
		const prepared = prepareZaloArticleContent({
			author: "CyberShield35",
			blocks: [
				{
					content:
						"Nội dung bài viết giải thích những điểm chính để người đọc dễ theo dõi.",
					id: "body",
					type: "text",
				},
			],
			commentsEnabled: true,
			description:
				"CyberShield35 tổng hợp các dữ kiện đã được kiểm chứng, đối chiếu thông tin từ nhiều nguồn và trình bày ngắn gọn để người đọc có thể hiểu đúng bối cảnh trước khi chia sẻ nội dung trên môi trường số.",
			title:
				"HỘI NGHỊ TOÀN QUỐC NGHIÊN CỨU, HỌC TẬP, QUÁN TRIỆT VÀ TRIỂN KHAI THỰC HIỆN NGHỊ QUYẾT HỘI NGHỊ LẦN THỨ BA BAN CHẤP HÀNH TRUNG ƯƠNG",
		});

		expect(prepared.title.length).toBeLessThanOrEqual(
			ZALO_EDITORIAL_TITLE_LIMIT,
		);
		expect(prepared.title).not.toMatch(/\s\S*…$/u);
		expect(prepared.description.length).toBeLessThanOrEqual(
			ZALO_EDITORIAL_DESCRIPTION_LIMIT,
		);
		expect(prepared.description).toMatch(/[.!?]$/u);
		expect(prepared.description).not.toMatch(/\s\S*…$/u);
	});

	test("removes citation markers, emoji, and presentation characters", () => {
		const prepared = prepareZaloArticleContent({
			author: "CyberShield35 🚨",
			blocks: [
				{
					content:
						"🚨 Nội dung tiếng Việt vẫn giữ nguyên dấu [1].\n\n✅ Thông tin đã được đối chiếu 【2】.",
					id: "body",
					type: "text",
				},
				{
					caption: "📷 Ảnh gốc từ bài quét",
					id: "image",
					type: "image",
					url: "https://example.com/image.jpg",
				},
			],
			commentsEnabled: true,
			description: "✅ Bản tóm tắt đã được kiểm tra.",
			title: "🚨 Thông tin cần làm rõ",
		});

		expect(JSON.stringify(prepared)).not.toMatch(/[🚨✅📷]|\[1\]|【2】/u);
		expect(prepared.blocks[0]).toMatchObject({
			content:
				"Nội dung tiếng Việt vẫn giữ nguyên dấu.\n\nThông tin đã được đối chiếu.",
		});
	});

	test("keeps Zalo paragraphs separated and removes a redundant lead headline", () => {
		const prepared = prepareZaloArticleContent({
			author: "CyberShield35",
			blocks: [
				{
					content:
						"THÔNG CÁO BÁO CHÍ KỲ HỌP THỨ 10 CỦA ỦY BAN KIỂM TRA TRUNG ƯƠNG\nNgày 30/7/2026, tại Hà Nội.\nViệc kiểm tra đã đưa ra những kết luận quan trọng.\n\nCác nội dung tiếp theo được trình bày rõ ràng.",
					id: "body",
					type: "text",
				},
			],
			commentsEnabled: true,
			coverUrl: null,
			description: "Báo cáo tóm tắt nội dung kỳ họp và các kết luận liên quan.",
			title: "Các kết luận đáng chú ý từ kỳ họp thứ 10",
		});

		expect(prepared.blocks[0]).toMatchObject({
			content:
				"Ngày 30/7/2026, tại Hà Nội.\n\nViệc kiểm tra đã đưa ra những kết luận quan trọng.\n\nCác nội dung tiếp theo được trình bày rõ ràng.",
		});
		expect(prepared.blocks[0]?.type === "text" && prepared.blocks[0].content).not.toContain(
			"TRUNG ƯƠNGNgày",
		);
	});
});
