import type { ArticleContent } from "@/lib/articles/schemas";
import { cleanDraftContent } from "@/lib/domain/draft-content";
import type { ArticleAiOutput } from "@/lib/llm/schemas";

type AutomatedArticleEvidence = {
	metadata: Record<string, unknown>;
	quote: string;
	summary: string;
};

export function buildAutomatedArticleSeed(input: {
	body: string;
	draftKind: "response" | "comment" | "counter_argument" | "internal_brief";
	evidence: AutomatedArticleEvidence;
}): ArticleContent {
	const summary = cleanDraftContent(input.evidence.summary || input.evidence.quote);
	const fallbackTitle =
		input.draftKind === "counter_argument"
			? "Làm rõ thông tin cần được kiểm chứng"
			: input.draftKind === "response"
				? "Góc nhìn đáng chú ý từ thông tin đã kiểm chứng"
				: "Những điểm cần làm rõ từ thông tin đang được chia sẻ";

	return {
		author: "CyberShield35",
		blocks: [
			{
				content: cleanDraftContent(input.body),
				id: crypto.randomUUID(),
				type: "text",
			},
		],
		commentsEnabled: true,
		coverUrl: originalImageUrl(input.evidence.metadata),
		description: truncateText(summary, 300),
		title: truncateText(naturalTitle(summary) || fallbackTitle, 150),
	};
}

export function normalizeAutomatedArticleContent(
	seed: ArticleContent,
	proposal: ArticleAiOutput,
): ArticleContent {
	const title = normalizeGeneratedTitle(proposal.title, seed.title);
	const blocks: ArticleContent["blocks"] = [];
	for (const block of proposal.blocks) {
		if (block.type === "image") {
			if (block.url) blocks.push(block);
			continue;
		}
		const content = cleanArticleBody(block.content, title);
		if (content) blocks.push({ ...block, content });
	}
	const normalizedBlocks = blocks.length ? blocks : seed.blocks;

	return {
		author: cleanDraftContent(proposal.author) || seed.author,
		blocks: normalizedBlocks,
		commentsEnabled: proposal.commentsEnabled,
		coverUrl: seed.coverUrl ?? proposal.coverUrl,
		description: normalizeDescription(
			title,
			proposal.description,
			seed.description,
			normalizedBlocks,
		),
		title,
	};
}

function originalImageUrl(metadata: Record<string, unknown>) {
	const value = metadata.originalImageUrl;
	if (typeof value !== "string") return null;
	try {
		const url = new URL(value);
		return url.protocol === "https:" ? value : null;
	} catch {
		return null;
	}
}

function naturalTitle(value: string) {
	const firstLine =
		cleanDraftContent(value)
			.split("\n")
			.map((line) => line.trim())
			.find(Boolean) ?? "";
	const compact = firstLine
		.replace(/^#{1,6}\s*/u, "")
		.replace(/^["“”'‘’]+|["“”'‘’]+$/gu, "")
		.replace(/\s+/gu, " ")
		.trim();
	if (!compact) return "";
	const sentence = compact.split(/(?<=[.!?])\s/u)[0] ?? compact;
	return sentence.replace(/[.!?]+$/u, "").trim();
}

function normalizeGeneratedTitle(value: string, fallback: string) {
	const generated = naturalTitle(value);
	const safeFallback = naturalTitle(fallback);
	if (!generated) return truncateText(safeFallback, 150);
	if (
		safeFallback &&
		comparableText(generated).startsWith(comparableText(safeFallback)) &&
		comparableText(generated) !== comparableText(safeFallback)
	) {
		return truncateText(safeFallback, 150);
	}
	return truncateText(generated, 150);
}

function normalizeDescription(
	title: string,
	proposal: string,
	fallback: string,
	blocks: ArticleContent["blocks"],
) {
	const firstTextBlock = blocks.find((block) => block.type === "text");
	for (const candidate of [
		proposal,
		fallback,
		firstTextBlock?.type === "text"
			? firstTextBlock.content.split(/\n{2,}/u)[0]
			: "",
	]) {
		const description = stripLeadingTitle(candidate ?? "", title)
			.replace(/\s*\n+\s*/gu, " ")
			.replace(/\s{2,}/gu, " ")
			.trim();
		if (description.length >= 20) return truncateText(description, 280);
	}
	return "Bản nháp đang chờ biên tập viên kiểm tra nội dung và nguồn thông tin.";
}

function cleanArticleBody(value: string, title: string) {
	const content = cleanDraftContent(value);
	const [firstLine = "", ...remainingLines] = content.split("\n");
	if (
		remainingLines.length &&
		comparableText(firstLine) === comparableText(title)
	) {
		return remainingLines.join("\n").trim();
	}
	return content;
}

function stripLeadingTitle(value: string, title: string) {
	const content = cleanDraftContent(value);
	if (
		title &&
		content
			.toLocaleLowerCase("vi-VN")
			.startsWith(title.toLocaleLowerCase("vi-VN"))
	) {
		return content
			.slice(title.length)
			.replace(/^[\s:–—-]+/u, "")
			.trim();
	}
	return content;
}

function comparableText(value: string) {
	return value
		.normalize("NFKC")
		.toLocaleLowerCase("vi-VN")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

function truncateText(value: string, limit: number) {
	if (value.length <= limit) return value;
	const sliced = value.slice(0, limit - 1);
	const lastSpace = sliced.lastIndexOf(" ");
	return `${(lastSpace > limit * 0.6 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
}
