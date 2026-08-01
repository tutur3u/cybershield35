import { describe, expect, test } from "bun:test";

import {
	parseStoredReportTemplates,
	serializeStoredReportTemplates,
} from "@/lib/domain/report-template-storage";

describe("report template storage", () => {
	test("round-trips valid custom templates", () => {
		const raw = serializeStoredReportTemplates(
			[
				{
					description: "Tóm tắt phục vụ điều phối nội bộ.",
					kind: "custom-leadership",
					sections: ["Tình hình", "Khuyến nghị"],
					title: "Báo cáo nhanh",
				},
			],
			["executive-summary"],
		);

		expect(parseStoredReportTemplates(raw)).toEqual({
			customReports: [
				{
					description: "Tóm tắt phục vụ điều phối nội bộ.",
					kind: "custom-leadership",
					sections: ["Tình hình", "Khuyến nghị"],
					title: "Báo cáo nhanh",
				},
			],
			hiddenReportKinds: ["executive-summary"],
			version: 1,
		});
	});

	test("rejects malformed and non-custom templates", () => {
		expect(parseStoredReportTemplates("not-json")).toEqual({
			customReports: [],
			hiddenReportKinds: [],
			version: 1,
		});
		expect(
			parseStoredReportTemplates(
				JSON.stringify({
					customReports: [
						{
							description: "Cannot override a built-in",
							kind: "executive-summary",
							sections: ["One"],
							title: "Invalid",
						},
					],
					hiddenReportKinds: [],
					version: 1,
				}),
			).customReports,
		).toEqual([]);
	});
});
