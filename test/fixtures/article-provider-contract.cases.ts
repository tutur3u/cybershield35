import { expect, test } from "bun:test";
import type { ArticleAiOutput } from "@/lib/llm/schemas";
import { generateArticleRevision } from "@/lib/llm/generation";

// Exercise the actual SDK and schema parser against an isolated HTTP provider.
test("repairs a gateway response with string blocks using an explicit object contract", async () => {
	const requests: Array<{ messages: Array<{ content: string }> }> = [];
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
					"Thư viện mở cửa sáng thứ Bảy từ tuần tới.\n\nBạn đọc có thêm thời gian đến đọc sách vào cuối tuần.",
			},
		],
	};
	const server = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		async fetch(request) {
			requests.push((await request.json()) as (typeof requests)[number]);
			const output =
				requests.length === 1
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
		const result = await generateArticleRevision({
			action: "draft",
			content: { ...article, blocks: [] },
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
		expect(result).toEqual(article);
		expect(requests).toHaveLength(2);
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
		expect(first.outputRequirements.blockFormat.text).toMatchObject({
			id: "text-1",
			type: "text",
		});
		expect(retry.repairInstructions.length).toBeGreaterThan(0);
		expect(retry.evidence).toEqual(first.evidence);
	} finally {
		server.stop(true);
	}
});
