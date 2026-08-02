import { describe, expect, test } from "bun:test";

import {
	resolveRiskFlagEvidence,
	scoreRiskFlagEvidence,
	validateAnalysisEvidenceLinks,
} from "@/lib/domain/analysis-evidence";
import type { AnalysisOutput } from "@/lib/llm/schemas";

const shipperStory = {
	id: "shipper",
	quote:
		"Cái kết ấm lòng cho anh shipper đánh rơi kiện hàng trên đường. Kiện hàng đã được trao trả lại tận tay.",
	summary: "Một kiện hàng bị đánh rơi đã được người dân trả lại cho shipper.",
};

const childStory = {
	id: "child",
	quote:
		"Một người đàn ông lạ mặt cố ý tiếp cận và dẫn một bé gái đi nơi khác giữa ban ngày.",
	summary: "Cảnh báo phụ huynh có con nhỏ về nguy cơ đối với trẻ em.",
};

const trafficViolationStory = {
	id: "traffic",
	quote:
		"Tài xế vượt đèn đỏ và chạy quá tốc độ, gây va chạm giao thông nghiêm trọng.",
	summary: "Hành vi vi phạm giao thông đã được ghi nhận.",
};

describe("analysis evidence linking", () => {
	test("links the reported child-safety story, not the shipper story", () => {
		const result = resolveRiskFlagEvidence(
			{ label: "Mối lo ngại về an toàn trẻ em" },
			[shipperStory, childStory, trafficViolationStory],
		);

		expect(result.evidence.map((item) => item.id)).toEqual(["child"]);
		expect(scoreRiskFlagEvidence("Mối lo ngại về an toàn trẻ em", shipperStory)).toBe(0);
	});

	test("links actual traffic violations, not child safety or a package on a road", () => {
		const result = resolveRiskFlagEvidence(
			{ label: "Vi phạm giao thông nghiêm trọng" },
			[childStory, shipperStory, trafficViolationStory],
		);

		expect(result.evidence.map((item) => item.id)).toEqual(["traffic"]);
	});

	test("uses whole semantic concepts instead of substring and severity fallbacks", () => {
		expect(
			scoreRiskFlagEvidence("Lo ngại về trẻ em", {
				id: "unrelated",
				quote: "Kiện hàng được tìm thấy trên đường.",
				summary: "Tin vui trong ngày.",
			}),
		).toBe(0);
		expect(
			resolveRiskFlagEvidence(
				{ label: "Mối lo ngại về an toàn trẻ em" },
				[shipperStory],
			).evidence,
		).toEqual([]);
	});

	test("does not confuse a public-safety meeting with petty theft", () => {
		const meetingStory = {
			id: "meeting",
			quote: "Công an tỉnh tổ chức gặp mặt người có ảnh hưởng trên không gian mạng.",
			summary: "Hội nghị ra mắt câu lạc bộ niềm tin số.",
		};
		const theftStory = {
			id: "theft",
			quote: "Khách vào sạc nhờ xe điện rồi lấy luôn chiếc nón của chủ quán.",
			summary: "Một vụ trộm cắp vặt được chủ quán chia sẻ.",
		};

		expect(
			resolveRiskFlagEvidence(
				{ label: "Tội phạm vặt/trộm cắp" },
				[meetingStory, theftStory],
			).evidence.map((item) => item.id),
		).toEqual(["theft"]);
	});

	test("rejects incompatible citations and recalculates the displayed count", () => {
		const analysis: AnalysisOutput = {
			riskLevel: "high",
			summary: "Tóm tắt",
			stanceSummary: "Lập trường",
			topicClusters: [],
			claims: [
				{
					claim: "Có cảnh báo an toàn trẻ em.",
					confidence: 0.9,
					evidenceIds: ["child", "missing"],
					rationale: "Bài viết mô tả người lạ tiếp cận một bé gái.",
					stance: "concerned",
				},
			],
			riskFlags: [
				{
					confidence: 0.9,
					count: 2,
					evidenceIds: ["shipper", "child"],
					label: "Mối lo ngại về an toàn trẻ em",
					rationale: "Người lạ tiếp cận một bé gái.",
					severity: "high",
				},
			],
			sentiment: { negative: 1, neutral: 0, positive: 0, total: 1 },
		};

		const validated = validateAnalysisEvidenceLinks(analysis, [
			shipperStory,
			childStory,
		]);

		expect(validated.claims[0]?.evidenceIds).toEqual(["child"]);
		expect(validated.riskFlags[0]?.evidenceIds).toEqual(["child"]);
		expect(validated.riskFlags[0]?.count).toBe(1);
	});
});
