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

export function reconcileAutomatedArticleContent(
	seed: ArticleContent,
	current: ArticleContent,
): ArticleContent {
	return normalizeAutomatedArticleContent(seed, {
		...current,
		coverUrl: current.coverUrl ?? null,
		reviewNotes: [],
	});
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
		const description = removeTrailingClippedParagraph(
			stripLeadingTitle(candidate ?? "", title),
		)
			.replace(/\s*\n+\s*/gu, " ")
			.replace(/\s{2,}/gu, " ")
			.trim();
		if (description.length >= 20) return truncateText(description, 280);
	}
	return "Bản nháp đang chờ biên tập viên kiểm tra nội dung và nguồn thông tin.";
}

function cleanArticleBody(value: string, title: string) {
	const content = cleanDraftContent(value);
	const paragraphs = content
		.split(/\n{2,}/u)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);
	if (
		paragraphs.length > 1 &&
		comparableText(paragraphs[0] ?? "") === comparableText(title)
	) {
		paragraphs.shift();
	}
	return paragraphs
		.filter((paragraph, index) => {
			const next = paragraphs[index + 1];
			if (!next) return true;
			const compact = comparableText(paragraph);
			const nextCompact = comparableText(next);
			return !(
				paragraph.length <= 80 &&
				compact.length >= 8 &&
				compact !== nextCompact &&
				nextCompact.startsWith(compact) &&
				!/[.!?…:;]$/u.test(paragraph)
			);
		})
		.join("\n\n")
		.trim();
}

function stripLeadingTitle(value: string, title: string) {
	const content = cleanDraftContent(value).normalize("NFKC");
	const titleTokens = comparableText(title).split(/\s+/u).filter(Boolean);
	if (!titleTokens.length) return content;
	const titlePattern = titleTokens
		.map(escapeRegExp)
		.join(String.raw`[^\p{L}\p{N}]+`);
	return content
		.replace(
			new RegExp(
				String.raw`^[^\p{L}\p{N}]*${titlePattern}[^\p{L}\p{N}]*`,
				"iu",
			),
			"",
		)
		.trim();
}

function removeTrailingClippedParagraph(value: string) {
	const paragraphs = value
		.split(/\n{2,}/u)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);
	const last = paragraphs.at(-1);
	if (
		paragraphs.length > 1 &&
		last &&
		last.length <= 60 &&
		last.split(/\s+/u).length <= 6 &&
		!/[.!?…:;]$/u.test(last)
	) {
		paragraphs.pop();
	}
	return paragraphs.join("\n\n");
}

function comparableText(value: string) {
	return value
		.normalize("NFKC")
		.toLocaleLowerCase("vi-VN")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

function truncateText(value: string, limit: number) {
	if (value.length <= limit) return value;
	const sliced = value.slice(0, limit - 1);
	const lastSpace = sliced.lastIndexOf(" ");
	return `${(lastSpace > limit * 0.6 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
}
