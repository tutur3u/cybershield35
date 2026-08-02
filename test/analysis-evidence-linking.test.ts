import { describe, expect, test } from "bun:test";

import {
	resolveRiskFlagEvidence,
	isProofExcerptGrounded,
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
					proofs: [
						{
							confidence: 0.9,
							evidenceId: "child",
							excerpt: "Một người đàn ông lạ mặt cố ý tiếp cận và dẫn một bé gái",
							limitation: "Chưa có kết luận điều tra.",
							support: "Trích đoạn mô tả trực tiếp hành vi tiếp cận một trẻ em.",
						},
						{
							confidence: 0.5,
							evidenceId: "missing",
							excerpt: "Một trích đoạn không có nguồn tương ứng trong scan",
							limitation: null,
							support: "Liên kết này phải bị loại vì không có nguồn tương ứng.",
						},
					],
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
					proofs: [
						{
							confidence: 0.7,
							evidenceId: "shipper",
							excerpt: "Cái kết ấm lòng cho anh shipper đánh rơi kiện hàng trên đường",
							limitation: null,
							support: "Liên kết sai chủ đề dù trích đoạn tồn tại trong nguồn.",
						},
						{
							confidence: 0.9,
							evidenceId: "child",
							excerpt: "Một người đàn ông lạ mặt cố ý tiếp cận và dẫn một bé gái",
							limitation: "Chưa có kết luận điều tra.",
							support: "Trích đoạn mô tả trực tiếp hành vi tiếp cận một trẻ em.",
						},
					],
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
		expect(validated.riskFlags[0]?.proofs).toHaveLength(1);
	});

	test("requires every generated proof excerpt to exist in its cited source", () => {
		expect(
			isProofExcerptGrounded(
				{ excerpt: "Một người đàn ông lạ mặt cố ý tiếp cận" },
				childStory,
			),
		).toBe(true);
		expect(
			isProofExcerptGrounded(
				{ excerpt: "Cơ quan chức năng đã xác nhận vụ bắt cóc" },
				childStory,
			),
		).toBe(false);
		expect(
			isProofExcerptGrounded(
				{ excerpt: "Mot nguoi dan ong la mat co y tiep can" },
				childStory,
			),
		).toBe(false);
	});

	test("normalizes duplicate topics, impossible counts, and sentiment totals", () => {
		const analysis: AnalysisOutput = {
			riskLevel: "medium",
			summary: "Tóm tắt",
			stanceSummary: "Lập trường",
			topicClusters: [
				{
					count: 99,
					name: "An toàn trẻ em",
					riskLevel: "high",
					trend: "Tăng",
				},
				{
					count: 1,
					name: "AN TOÀN TRẺ EM",
					riskLevel: "high",
					trend: "Tăng",
				},
			],
			claims: [],
			riskFlags: [],
			sentiment: { negative: 1, neutral: 2, positive: 3, total: 99 },
		};

		const validated = validateAnalysisEvidenceLinks(analysis, [childStory]);

		expect(validated.topicClusters).toHaveLength(1);
		expect(validated.topicClusters[0]?.count).toBe(1);
		expect(validated.sentiment.total).toBe(6);
	});

	test("bounds recoverable LLM over-generation after grounding", () => {
		const proof = {
			confidence: 0.9,
			evidenceId: "child",
			excerpt: childStory.quote,
			limitation: "L".repeat(700),
			support: "S".repeat(1_000),
		};
		const analysis: AnalysisOutput = {
			riskLevel: "high",
			summary: "Tóm tắt",
			stanceSummary: "Lập trường",
			topicClusters: [],
			claims: Array.from({ length: 15 }, (_, index) => ({
				claim: `Nhận định ${index}`,
				confidence: 0.9,
				evidenceIds: ["child"],
				proofs: [proof, proof, proof, proof],
				rationale: "Có bằng chứng trực tiếp.",
				stance: "concerned",
			})),
			riskFlags: [],
			sentiment: { negative: 1, neutral: 0, positive: 0, total: 1 },
		};

		const validated = validateAnalysisEvidenceLinks(analysis, [childStory]);

		expect(validated.claims).toHaveLength(12);
		expect(validated.claims[0]?.proofs).toHaveLength(1);
		expect(validated.claims[0]?.proofs[0]?.support).toHaveLength(800);
		expect(validated.claims[0]?.proofs[0]?.limitation).toHaveLength(500);
	});
});
