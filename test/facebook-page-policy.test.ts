import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
	automatedDraftPolicy,
	facebookPageIdentity,
} from "@/lib/domain/facebook-page-policy";
import { DEFAULT_DRAFT_VOICE } from "@/lib/domain/draft-style";
import { assessEvidenceRisk } from "@/lib/domain/evidence-risk";

describe("Facebook page policy", () => {
	test("uses a stable Facebook ID before the mutable username", () => {
		expect(
			facebookPageIdentity({
				author: "@Trusted.Page",
				facebookPageId: "123456",
				sourceUrl: "https://facebook.com/trusted.page/posts/1",
			}),
		).toEqual({
			facebookPageId: "123456",
			pageKey: "id:123456",
			username: "trusted.page",
		});
	});

	test("drafts constructive trusted content and counterarguments for at-risk pages", () => {
		expect(
			automatedDraftPolicy({
				classification: "trusted",
				riskLevel: "low",
				sentiment: "positive",
				stance: "supportive",
			}),
		).toMatchObject({
			draftKind: "response",
			generationReason: "trusted_constructive_content",
			voice: DEFAULT_DRAFT_VOICE,
		});
		expect(
			automatedDraftPolicy({
				classification: "at_risk",
				riskLevel: "medium",
			}),
		).toMatchObject({
			draftKind: "counter_argument",
			generationReason: "at_risk_page",
			voice: DEFAULT_DRAFT_VOICE,
		});
	});

	test("drafts neutral coverage without supporting or opposing the source", () => {
		expect(
			automatedDraftPolicy({
				classification: "neutral",
				riskLevel: "high",
				sentiment: "negative",
				stance: "opposed",
			}),
		).toMatchObject({
			draftKind: "response",
			generationReason: "neutral_page",
			tone: "Khách quan, cân bằng, rõ ràng",
			voice: DEFAULT_DRAFT_VOICE,
		});
	});

	test("does not amplify ambiguous trusted-page content automatically", () => {
		expect(
			automatedDraftPolicy({
				classification: "trusted",
				riskLevel: "high",
				sentiment: "negative",
				stance: "opposed",
			}),
		).toBeNull();
	});

	test("scores each item by its content instead of the page classification", () => {
		const assessment = assessEvidenceRisk({
			comments: 250,
			shares: 80,
			sourceClassification: "at_risk",
			storedRisk: "high",
			text: "Nhà trường giảm học phí và trao học bổng cho sinh viên đạt điểm cao.",
		});

		expect(assessment.level).toBe("low");
		expect(assessment.reasons.join(" ")).toContain("thành tích học tập");
		expect(assessment.reasons.join(" ")).toContain("chấm theo nội dung");
	});

	test("treats enforcement, legal, and public-order events as high risk", () => {
		for (const text of [
			"Công an bắt giữ đối tượng sau chuyên án bảo đảm an ninh trật tự.",
			"Cơ quan điều tra khởi tố và bắt tạm giam bị can.",
			"Doanh nghiệp bị kiện ra tòa sau vụ đánh sập hệ thống.",
			"Đốt lò phiên bản có định hướng nhắm vào các đối tượng khác phe.",
			"Bài viết công kích Đảng Cộng sản và bộ máy chính quyền.",
			"Cơ quan chức năng tháo dỡ biển hiệu và đình chỉ hoạt động.",
		]) {
			expect(assessEvidenceRisk({ text }).level, text).toBe("high");
		}
	});

	test("keeps routine education and fee updates low risk", () => {
		for (const text of [
			"Học sinh đạt điểm cao trong kỳ thi và được tuyên dương.",
			"Chính phủ công bố giảm học phí cho sinh viên trong năm học mới.",
			"Trường trao học bổng và tổ chức lễ tốt nghiệp.",
		]) {
			expect(assessEvidenceRisk({ comments: 500, shares: 100, text }).level, text).toBe(
				"low",
			);
		}
	});

	test("uses medium risk for important civic policy without a severe event", () => {
		const assessment = assessEvidenceRisk({
			text: "Quốc hội thảo luận dự luật mới và chính sách quản lý đô thị.",
		});

		expect(assessment.level).toBe("medium");
		expect(assessment.reasons.join(" ")).toContain("vấn đề công");
	});
});

describe("Facebook page policy migration", () => {
	const migration = readFileSync("drizzle/0012_little_lenny_balinger.sql", "utf8");
	const neutralMigration = readFileSync("drizzle/0017_fuzzy_patch.sql", "utf8");

	test("adds an observable idempotent queue protected by RLS", () => {
		expect(migration).toContain(
			"draft_automation_jobs_evidence_classification_unique",
		);
		expect(migration).toContain("counter_argument_drafts_automation_key_unique");
		expect(migration).toContain(
			'ALTER TABLE "public"."draft_automation_jobs" ENABLE ROW LEVEL SECURITY',
		);
		expect(migration).toContain(
			'REVOKE ALL ON TABLE "public"."facebook_page_profiles" FROM PUBLIC',
		);
	});

	test("adds neutral as a durable page classification", () => {
		expect(neutralMigration).toContain(
			'ALTER TYPE "public"."facebook_page_classification" ADD VALUE \'neutral\'',
		);
	});
});
