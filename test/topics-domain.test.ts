import { describe, expect, test } from "bun:test";

import {
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
});
