import { describe, expect, test } from "bun:test";
import { NoObjectGeneratedError } from "ai";
import { unsupportedAttributionIssues } from "@/lib/articles/draft-quality";
import {
	articleCompletionIssues,
	ArticleGenerationError,
	generateCompleteArticle,
} from "@/lib/llm/article-completion";
import type { ArticleAiOutput } from "@/lib/llm/schemas";

const complete: ArticleAiOutput = {
	author: "CyberShield35",
	title: "Lịch mở cửa thư viện mới",
	description: "Thư viện mở cửa thêm vào cuối tuần để phục vụ bạn đọc.",
	coverUrl: null,
	commentsEnabled: true,
	reviewNotes: [],
	blocks: [
		{
			id: "body",
			type: "text",
			content:
				"Thư viện mở cửa vào sáng thứ Bảy từ tuần tới.\n\nBạn đọc có thêm thời gian đến đọc sách và sử dụng không gian học tập.",
		},
	],
};
const withBody = (content: string): ArticleAiOutput => ({
	...complete,
	blocks: [{ id: "body", type: "text", content }],
});

describe("complete AI articles", () => {
	test("accepts finished prose and complete quoted sentences", () => {
		expect(articleCompletionIssues(complete, "draft")).toEqual([]);
		expect(
			articleCompletionIssues(
				withBody(
					"Thông báo ghi rõ: “Thư viện mở cửa sáng thứ Bảy.”\n\nBạn đọc có thể đến thư viện vào cuối tuần.",
				),
				"draft",
			),
		).toEqual([]);
	});

	test("detects the exact truncated quote and editorial placeholder from the screenshot", () => {
		const issues = articleCompletionIssues(
			withBody(
				"Trích nội dung gốc: “Nội dung cần được chứng minh bằng những hành vi và chứng cứ cụ thể, thay v”\n\nPhần phân tích, dữ kiện bổ sung và kết luận sẽ được biên tập viên hoàn thiện tại đây.",
			),
			"draft",
		);
		expect(issues.some((issue) => issue.includes("chỗ trống"))).toBe(true);
		expect(issues.some((issue) => issue.includes("cắt dở"))).toBe(true);
	});

	test("rejects empty bodies, unfinished earlier paragraphs, ellipses and overlong fields", () => {
		for (const content of [
			{ ...complete, blocks: [] },
			withBody("Một câu bị cắt dở\n\nĐoạn cuối vẫn hoàn chỉnh."),
			withBody("Đoạn đầu hoàn chỉnh.\n\nĐoạn cuối bị cắt..."),
			{ ...complete, title: "Tiêu đề ".repeat(30) },
			{ ...complete, description: "Mô tả ".repeat(60) + "." },
		])
			expect(articleCompletionIssues(content, "draft").length).toBeGreaterThan(
				0,
			);
	});

	test("does not require an existing incomplete body to be repaired by a description-only edit", () => {
		expect(
			articleCompletionIssues(withBody("Nội dung đang soạn"), "description"),
		).toEqual([]);
		expect(
			articleCompletionIssues(
				{ ...complete, description: "", blocks: [] },
				"outline",
			),
		).toEqual([]);
	});

	test("repairs incomplete output once and returns only the complete revision", async () => {
		const attempts: string[][] = [];
		const output = await generateCompleteArticle(
			"draft",
			async (issues, attempt) => {
				attempts.push(issues);
				return {
					output: attempt ? complete : withBody("Câu bị cắt"),
					finishReason: "stop",
				};
			},
		);
		expect(output).toEqual(complete);
		expect(attempts).toHaveLength(2);
		expect(attempts[0]).toEqual([]);
		expect(attempts[1]?.length).toBeGreaterThan(0);
	});

	test("retries even valid JSON when the provider reports token exhaustion", async () => {
		let calls = 0;
		await generateCompleteArticle("draft", async () => ({
			output: complete,
			finishReason: ++calls === 1 ? "length" : "stop",
		}));
		expect(calls).toBe(2);
	});

	test("recovers from truncated or malformed structured output", async () => {
		let calls = 0;
		const output = await generateCompleteArticle("draft", async () => {
			if (++calls === 1)
				throw new NoObjectGeneratedError({
					message: "Invalid JSON",
					text: "{",
					response: { id: "test", timestamp: new Date(), modelId: "fixture" },
					usage: {
						inputTokens: 1,
						inputTokenDetails: {
							noCacheTokens: 1,
							cacheReadTokens: 0,
							cacheWriteTokens: 0,
						},
						outputTokens: 1,
						outputTokenDetails: { textTokens: 1, reasoningTokens: 0 },
						totalTokens: 2,
					},
					finishReason: "length",
				});
			return { output: complete, finishReason: "stop" };
		});
		expect(output).toEqual(complete);
		expect(calls).toBe(2);
	});

	test("fails without returning partial prose after the repair budget is exhausted", async () => {
		let calls = 0;
		await expect(
			generateCompleteArticle("draft", async () => {
				calls++;
				return {
					output: withBody("Người viết sẽ bổ sung nội dung."),
					finishReason: "stop",
				};
			}),
		).rejects.toBeInstanceOf(ArticleGenerationError);
		expect(calls).toBe(2);
	});

	test("does not retry authentication or provider availability failures as content errors", async () => {
		let calls = 0;
		await expect(
			generateCompleteArticle("draft", async () => {
				calls++;
				throw new Error("Provider unavailable");
			}),
		).rejects.toThrow("Provider unavailable");
		expect(calls).toBe(1);
	});
});

 test("repairs internal editorial notes instead of accepting them as public prose", async () => {
    let calls = 0;
    const result = await generateCompleteArticle("draft", async () => ({
        output: ++calls === 1 ? { ...complete, description: "Bài viết phân tích lịch mở cửa thư viện." } : complete,
        finishReason: "stop",
    }));
    expect(calls).toBe(2);
    expect(result).toEqual(complete);
 });
 test("permits attributed reporting and ordinary public writing", () => {
    expect(articleCompletionIssues(withBody("Theo thông báo của thư viện, phòng đọc mở thêm vào sáng thứ Bảy.\n\nBạn đọc có thêm một buổi đến thư viện vào cuối tuần."), "draft")).toEqual([]);
 });

test("rejects invented expert attribution and repairs with the specific grounding issue", async () => {
    const invented = withBody("Các chuyên gia pháp lý cho rằng thư viện cần mở cửa thêm.\n\nBạn đọc có thêm thời gian đọc sách.");
    const issues = unsupportedAttributionIssues(invented, "Thư viện mở cửa sáng thứ Bảy.");
    expect(issues).toHaveLength(1);
    let calls = 0;
    const result = await generateCompleteArticle("draft", async (repair) => {
        if (++calls === 1) return { output: invented, finishReason: "stop", additionalIssues: issues };
        expect(repair).toContain(issues[0]!);
        return { output: complete, finishReason: "stop" };
    });
    expect(result).toEqual(complete);
    expect(unsupportedAttributionIssues(invented, "Các chuyên gia pháp lý đề nghị thư viện mở cửa thêm.")).toEqual([]);
});

test("rejects invented start dates and frequency while allowing source-supported timing", () => {
    const invented = withBody("Thư viện mở thêm sáng thứ Bảy từ tuần tới. Phòng đọc phục vụ hằng tuần.");
    expect(unsupportedAttributionIssues(invented, "Thư viện mở thêm sáng thứ Bảy.")).toHaveLength(2);
    expect(unsupportedAttributionIssues(invented, "Thư viện mở thêm sáng thứ Bảy từ tuần tới, mỗi tuần.")).toEqual([]);
});

test("repairs rejected public wording without policing untouched fields or review notes", async () => {
  const robotic = "Theo đạo và bị phạt tù chưa có nghĩa là bị phạt tù vì theo đạo.";
  const approved = "Niềm tin tôn giáo không phải là lý do để phán xét một người.";
  let calls = 0;
  const result = await generateCompleteArticle("description", async (instructions) => {
    calls += 1;
    if (calls === 2) expect(instructions.join(" ")).toContain("câu khuôn mẫu");
    return { output: { ...complete, description: calls === 1 ? robotic : approved }, finishReason: "stop" };
  });
  expect(calls).toBe(2);
  expect(result.description).toBe(approved);
  const legacy = { ...complete, title:"Đọc đủ thông tin trước khi kết luận", blocks:withBody(robotic).blocks };
  expect(articleCompletionIssues(legacy,"description")).toEqual([]);
  expect(articleCompletionIssues(legacy,"title_description").length).toBeGreaterThan(0);
  expect(articleCompletionIssues(legacy,"draft").length).toBeGreaterThan(0);
  const withNotes = {...complete,reviewNotes:["Hồ sơ hiện có chưa đủ để xác minh."]};
  expect(articleCompletionIssues(withNotes,"claim_check")).toEqual([]);
});
