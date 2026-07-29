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
	const blocks: ArticleContent["blocks"] = [];
	for (const block of proposal.blocks) {
		if (block.type === "image") {
			if (block.url) blocks.push(block);
			continue;
		}
		const content = cleanDraftContent(block.content);
		if (content) blocks.push({ ...block, content });
	}

	return {
		author: cleanDraftContent(proposal.author) || seed.author,
		blocks: blocks.length ? blocks : seed.blocks,
		commentsEnabled: proposal.commentsEnabled,
		coverUrl: seed.coverUrl ?? proposal.coverUrl,
		description:
			truncateText(cleanDraftContent(proposal.description), 300) ||
			seed.description,
		title:
			truncateText(cleanDraftContent(proposal.title), 150) || seed.title,
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
	const compact = value
		.replace(/^["“”'‘’]+|["“”'‘’]+$/gu, "")
		.replace(/\s+/gu, " ")
		.trim();
	if (!compact) return "";
	const sentence = compact.split(/(?<=[.!?])\s/u)[0] ?? compact;
	return sentence.replace(/[.!?]+$/u, "").trim();
}

function truncateText(value: string, limit: number) {
	if (value.length <= limit) return value;
	const sliced = value.slice(0, limit - 1);
	const lastSpace = sliced.lastIndexOf(" ");
	return `${(lastSpace > limit * 0.6 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
}
