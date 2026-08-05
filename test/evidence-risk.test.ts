import { describe, expect, test } from "bun:test";

import { assessEvidenceRisk } from "@/lib/domain/evidence-risk";

describe("Evidence risk classification", () => {
	test("flags inflammatory political posts as high risk", () => {
		const assessment = assessEvidenceRisk({
			text: "Nói láo cái gì cũng nói được. Nướng 2 triệu người nhân danh chống đế quốc Mỹ rồi giờ lại ra tận cửa biển đón.",
		});

		expect(assessment.level).toBe("high");
		expect(assessment.categories).toContain("political");
		expect(assessment.reasons.join(" ")).toContain("chính trị");
	});

	test("treats politics, security and public-order content as high risk", () => {
		for (const text of [
			"Bài viết kêu gọi lật đổ chính quyền và thay đổi chế độ.",
			"Diễn biến an ninh trật tự tại địa bàn sau vụ tụ tập đông người.",
			"Công an và quân đội phối hợp bảo đảm an ninh quốc gia.",
			"Tranh chấp chủ quyền ở Biển Đông tiếp tục nóng lên.",
			"Nhóm này bị cho là phản động, chống phá nhà nước.",
			"Bài đăng xuyên tạc lịch sử và kích động dư luận.",
			"Bầu cử và quyền tự do ngôn luận đang được tranh luận gay gắt.",
		]) {
			expect(assessEvidenceRisk({ text }).level, text).toBe("high");
		}
	});

	test("matches obfuscated spellings of sensitive terms", () => {
		expect(assessEvidenceRisk({ text: "c.ô.n.g a.n vừa có mặt tại hiện trường" }).level).toBe(
			"high",
		);
		expect(assessEvidenceRisk({ text: "Đ.ế Q.uốc M.ỹ quay lại" }).level).toBe("high");
	});

	test("escalates insults aimed at public institutions", () => {
		const assessment = assessEvidenceRisk({
			text: "Quốc hội toàn một lũ chúng nói láo, chính sách gì cũng nói được.",
		});

		expect(assessment.level).toBe("high");
		expect(assessment.categories).toContain("inflammatory");
	});

	test("keeps everyday service and education posts low risk", () => {
		for (const text of [
			"Quán cà phê thông báo lịch nghỉ lễ và chương trình khuyến mãi.",
			"Trường trao học bổng và tổ chức lễ tốt nghiệp cho sinh viên.",
			"Tiệm vàng cập nhật giá mỗi ngày, mua 1 tặng 1 trong hôm nay.",
		]) {
			expect(assessEvidenceRisk({ comments: 400, shares: 90, text }).level, text).toBe(
				"low",
			);
		}
	});

	test("returns reusable categories for reporting", () => {
		const assessment = assessEvidenceRisk({
			text: "Cơ quan điều tra khởi tố và bắt tạm giam bị can trong vụ tham nhũng.",
		});

		expect(assessment.level).toBe("high");
		expect(assessment.categories).toContain("enforcement");
		expect(assessment.signals.length).toBeGreaterThan(0);
	});
});
