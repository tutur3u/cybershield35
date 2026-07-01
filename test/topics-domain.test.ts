import { describe, expect, test } from "bun:test";

import {
	inferTopicsForEvidence,
	scoreEvidenceForTopic,
	selectEvidenceForTopic,
	topicSlug,
	topicTokens,
} from "@/lib/domain/topics";

describe("topic normalization", () => {
	test("creates stable Vietnamese-safe slugs and search tokens", () => {
		expect(topicSlug("Quy định pháp luật & Quản lý thông tin")).toBe(
			"quy-dinh-phap-luat-quan-ly-thong-tin",
		);
		expect(topicTokens("Phát triển kinh tế & Quy hoạch")).toEqual([
			"phat",
			"trien",
			"kinh",
			"quy",
			"hoach",
		]);
	});

	test("selects related evidence deterministically", () => {
		const topic = {
			count: 1,
			name: "An ninh trật tự",
			riskLevel: "high" as const,
			trend: "increasing",
		};
		const related = {
			id: "evidence-1",
			quote: "Cảnh báo về an ninh trật tự và tin giả",
			riskLevel: "high" as const,
			summary: "Nội dung liên quan đến an ninh cộng đồng.",
		};
		const unrelated = {
			id: "evidence-2",
			quote: "Thông tin về lịch sử địa phương",
			riskLevel: "low" as const,
			summary: "Không cùng chủ đề.",
		};

		expect(scoreEvidenceForTopic(topic, related)).toBeGreaterThan(
			scoreEvidenceForTopic(topic, unrelated),
		);
		expect(selectEvidenceForTopic(topic, [unrelated, related])).toEqual([
			expect.objectContaining({ item: related }),
		]);
	});

	test("does not force weak fallback topic links", () => {
		const topic = {
			count: 1,
			name: "An ninh trật tự",
			riskLevel: "high" as const,
			trend: "increasing",
		};
		const unrelated = {
			id: "evidence-local-event",
			quote: "Phan Bội Châu tối nay, nhóm bạn nữ dành cho nhau những lời chúc mừng.",
			riskLevel: "low" as const,
			summary: "Một cập nhật cộng đồng địa phương.",
		};

		expect(scoreEvidenceForTopic(topic, unrelated)).toBeLessThan(30);
		expect(selectEvidenceForTopic(topic, [unrelated])).toEqual([]);
	});

	test("infers practical first-class topics from Vietnamese evidence", () => {
		const examples = [
			{
				expected: "Giao thông & Hạ tầng",
				item: {
					id: "traffic",
					quote: "Va chạm giữa xe Defender và Mazda tại khu vực Chợ Tân An.",
					riskLevel: "medium" as const,
					summary: "Tai nạn giao thông cần theo dõi.",
				},
			},
			{
				expected: "Môi trường & Dịch vụ công cộng",
				item: {
					id: "utilities",
					quote: "Người dân phản ánh rác, điện và nước sinh hoạt chưa ổn định.",
					riskLevel: "medium" as const,
					summary: "Dịch vụ công cộng bị gián đoạn.",
				},
			},
			{
				expected: "Ẩm thực & Du lịch",
				item: {
					id: "travel",
					quote: "Đánh giá quán cà phê ven sông có view đẹp cho khách du lịch.",
					riskLevel: "low" as const,
					summary: "Nội dung về trải nghiệm địa phương.",
				},
			},
			{
				expected: "Kinh tế & Tài chính",
				item: {
					id: "finance",
					quote: "Giá vàng tăng, mỗi lượng chênh lệch hơn 180 triệu đồng.",
					riskLevel: "low" as const,
					summary: "Thông tin tài chính thị trường.",
				},
			},
		];

		for (const example of examples) {
			expect(inferTopicsForEvidence(example.item).map((topic) => topic.name)).toContain(
				example.expected,
			);
		}
	});
});
