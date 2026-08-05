import { describe, expect, test } from "bun:test";

import {
	fitTextToLimit,
	isCleanlyFitted,
} from "@/lib/domain/text-fit";
import {
	prepareZaloTitle,
	ZALO_EDITORIAL_TITLE_LIMIT,
} from "@/lib/zalo/article-content";

describe("Fitting capped text", () => {
	test("keeps text untouched when it already fits", () => {
		const value = "Chính phủ công bố chính sách hỗ trợ học phí.";
		expect(fitTextToLimit(value, 110)).toBe(value);
	});

	test("prefers a complete sentence over a mid-sentence cut", () => {
		const value =
			"Cơ quan chức năng đã công bố kết luận. Người dân được đề nghị theo dõi thông tin chính thức từ các kênh của địa phương.";
		const fitted = fitTextToLimit(value, 60);

		expect(fitted).toBe("Cơ quan chức năng đã công bố kết luận.");
		expect(fitted.length).toBeLessThanOrEqual(60);
	});

	test("never cuts in the middle of a word", () => {
		const value =
			"Ủy ban nhân dân tỉnh vừa ban hành quyết định điều chỉnh quy hoạch khu đô thị phía đông thành phố";
		const fitted = fitTextToLimit(value, 50);

		expect(value.startsWith(fitted)).toBe(true);
		expect(value[fitted.length] === undefined || value[fitted.length] === " ").toBe(
			true,
		);
	});

	test("never ends on a dangling connective", () => {
		for (const [value, limit] of [
			["Chính phủ công bố chính sách mới về giáo dục và đào tạo", 40],
			["Hội nghị bàn về công tác phòng chống thiên tai của các tỉnh", 34],
			["Thông báo điều chỉnh lịch làm việc trong tuần tới", 40],
		] as const) {
			const fitted = fitTextToLimit(value, limit);
			expect(fitted.length, value).toBeLessThanOrEqual(limit);
			expect(isCleanlyFitted(fitted, limit), `${value} -> ${fitted}`).toBe(true);
		}
	});

	test("adds an ellipsis only when asked and still respects the limit", () => {
		const value =
			"Đây là một đoạn nội dung rất dài cần được rút gọn lại cho vừa với ô hiển thị";
		const plain = fitTextToLimit(value, 40);
		const elided = fitTextToLimit(value, 40, { ellipsis: true });

		expect(plain.endsWith("…")).toBe(false);
		expect(elided.endsWith("…")).toBe(true);
		expect(elided.length).toBeLessThanOrEqual(40);
	});

	test("treats clipped or dangling text as not cleanly fitted", () => {
		expect(isCleanlyFitted("Một tiêu đề hoàn chỉnh", 110)).toBe(true);
		expect(isCleanlyFitted("Một tiêu đề bị cắt giữa chừng và", 110)).toBe(false);
		expect(isCleanlyFitted("Một tiêu đề bị cắt…", 110)).toBe(false);
		expect(isCleanlyFitted("Tiêu đề quá dài", 5)).toBe(false);
	});

	test("Zalo titles stay within the editorial cap without a broken tail", () => {
		const title = prepareZaloTitle(
			"Bộ Giáo dục và Đào tạo công bố phương án tổ chức kỳ thi tốt nghiệp trung học phổ thông năm tới với nhiều điều chỉnh quan trọng về hình thức",
		);

		expect(title.length).toBeLessThanOrEqual(ZALO_EDITORIAL_TITLE_LIMIT);
		expect(isCleanlyFitted(title, ZALO_EDITORIAL_TITLE_LIMIT)).toBe(true);
	});
});
