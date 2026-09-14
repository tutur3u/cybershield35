import { expect, test } from "bun:test";
import type { ArticleAiOutput } from "@/lib/llm/schemas";
import { generateArticleRevision } from "@/lib/llm/generation";

// Exercise the actual SDK and schema parser against an isolated HTTP provider.
for (const failure of ["malformed", "transient", "unauthorized"] as const) {
test(`handles ${failure} gateway responses without partial writes`, async () => {
	const requests: Array<{ messages: Array<{ content: string }>; response_format: { type: string }; max_tokens?: number; max_completion_tokens?: number }> = [];
	const article: ArticleAiOutput = {
		author: "CyberShield35",
		title: "Lịch thư viện cuối tuần",
		description: "Thư viện mở thêm sáng thứ Bảy cho bạn đọc.",
		commentsEnabled: true,
		coverUrl: null,
		reviewNotes: [],
		blocks: [
			{
				id: "text-1",
				type: "text",
				content:
					"Thư viện mở cửa sáng thứ Bảy.\n\nBạn đọc có thêm thời gian đến đọc sách vào cuối tuần.",
			},
		],
	};
	const server = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		async fetch(request) {
			requests.push((await request.json()) as (typeof requests)[number]);
			if (failure === "unauthorized" || (failure === "transient" && requests.length <= 2)) {
                return Response.json({ error: { message: "Provider temporarily unavailable", type: "api_error" } }, { status: failure === "unauthorized" ? 401 : 503, headers: { "retry-after": "0" } });
            }
            const output =
				failure === "malformed" && requests.length === 1
					? { ...article, blocks: article.blocks.map((block) => block.type === "text" ? block.content : block.url) }
					: article;
			return Response.json({
				id: "qa",
				object: "chat.completion",
				created: 1,
				model: "fixture",
				choices: [
					{
						index: 0,
						message: { role: "assistant", content: JSON.stringify(output) },
						finish_reason: "stop",
					},
				],
				usage: { prompt_tokens: 20, completion_tokens: 50, total_tokens: 70 },
			});
		},
	});
	process.env.TUTURUUU_AI_BASE_URL = `http://127.0.0.1:${server.port}/v1`;
	try {
		const generation = generateArticleRevision({
			action: "draft",
			content: { ...article, blocks: [{ id: "legacy", type: "text", content: "Trích nội dung gốc: câu cắt dở. Biên tập viên sẽ hoàn thiện." }] },
			editorialIntent: "balanced",
			evidence: [
				{
					id: "source",
					quote: "Thư viện mở thêm sáng thứ Bảy.",
					summary: "Lịch thư viện.",
				},
			],
			tone: "Khách quan",
			voice: "Tự nhiên",
			session: { accessToken: "ttr_app_test", workspaceId: "qa" },
		});
		if (failure === "unauthorized") {
            await expect(generation).rejects.toThrow();
            expect(requests).toHaveLength(1);
            return;
        }
        expect(await generation).toEqual(article);
		expect(requests).toHaveLength(failure === "transient" ? 3 : 2);
        expect(requests[0]!.max_tokens ?? requests[0]!.max_completion_tokens).toBe(16_000);
		expect(requests[0]!.response_format).toEqual({ type: "json_object" });
		const first = JSON.parse(
			requests[0]!.messages.find((message) =>
				message.content.startsWith('{"action"'),
			)!.content,
		);
		const retry = JSON.parse(
			requests[1]!.messages.find((message) =>
				message.content.startsWith('{"action"'),
			)!.content,
		);
		expect(first.outputSchema.type).toBe("object");
        expect(first.currentArticle.blocks).toEqual([]);
        expect(first.currentArticle.title).toBe("");
        expect(first.currentArticle.description).toBe("");
		expect(first.outputRequirements.blockFormat.text).toMatchObject({
			id: "text-1",
			type: "text",
		});
		if (failure === "malformed") expect(retry.repairInstructions.length).toBeGreaterThan(0);
		expect(retry.evidence).toEqual(first.evidence);
	} finally {
		server.stop(true);
	}
});

}
