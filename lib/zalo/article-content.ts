import type { ArticleContent } from "@/lib/articles/schemas";
import { cleanDraftContent } from "@/lib/domain/draft-content";

export const ZALO_EDITORIAL_TITLE_LIMIT = 110;
export const ZALO_EDITORIAL_DESCRIPTION_LIMIT = 180;

const EMOJI_OR_PRESENTATION_MARK =
	/[\p{Extended_Pictographic}\u200D\u20E3\uFE0E\uFE0F]/gu;
const UNSUPPORTED_FORMAT_CHARACTER = /[\p{Cc}\p{Cf}]/gu;

/**
 * Produces the canonical article representation used by both the CS35 editor
 * and the Zalo Article API. The limits are intentionally below Zalo's hard
 * limits so its manager preview never has to clip a title or excerpt.
 */
export function prepareZaloArticleContent(
	content: ArticleContent,
): ArticleContent {
	const title = prepareZaloTitle(content.title);
	const blocks = content.blocks
		.map((block) => {
			if (block.type === "image") {
				const caption = block.caption
					? sanitizeZaloText(block.caption, false).slice(0, 300).trim()
					: "";
				return {
					...(caption ? { caption } : {}),
					id: block.id,
					type: "image" as const,
					url: block.url,
				};
			}
			return {
				content: prepareZaloBody(block.content, title),
				id: block.id,
				type: "text" as const,
			};
		})
		.filter((block) => block.type === "image" || Boolean(block.content));

	return {
		author: sanitizeZaloText(content.author, false).slice(0, 50).trim(),
		blocks,
		commentsEnabled: content.commentsEnabled,
		coverUrl: content.coverUrl ?? null,
		description: prepareZaloDescription({
			blocks,
			description: content.description,
			title,
		}),
		title,
	};
}

export function prepareZaloTitle(value: string) {
	const firstLine =
		sanitizeZaloText(value, false)
			.split("\n")
			.map((line) => line.trim())
			.find(Boolean) ?? "";
	const title = firstLine
		.replace(/^#{1,6}\s*/u, "")
		.replace(/^["“”'‘’]+|["“”'‘’]+$/gu, "")
		.replace(/\s+/gu, " ")
		.trim();
	return truncateAtWord(title, ZALO_EDITORIAL_TITLE_LIMIT)
		.replace(/[,:;–—-]+$/u, "")
		.trim();
}

function prepareZaloDescription(input: {
	blocks: ArticleContent["blocks"];
	description: string;
	title: string;
}) {
	const firstText = input.blocks.find((block) => block.type === "text");
	for (const candidate of [
		input.description,
		firstText?.type === "text"
			? firstText.content.split(/\n{2,}/u)[0]
			: "",
	]) {
		const withoutTitle = stripLeadingTitle(
			sanitizeZaloText(candidate ?? "", false),
			input.title,
		)
			.replace(/\s*\n+\s*/gu, " ")
			.replace(/\s{2,}/gu, " ")
			.trim();
		if (withoutTitle.length < 20) continue;
		const excerpt = completeExcerpt(withoutTitle);
		if (excerpt) return excerpt;
	}
	return "Nội dung đang chờ biên tập viên kiểm tra và hoàn thiện trước khi đăng.";
}

function prepareZaloBody(value: string, title: string) {
	const paragraphs = sanitizeZaloText(value, true)
		.split(/\n{2,}/u)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);
	if (
		paragraphs.length &&
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

function sanitizeZaloText(value: string, preserveParagraphs: boolean) {
	const normalized = cleanDraftContent(value)
		.normalize("NFKC")
		.replace(EMOJI_OR_PRESENTATION_MARK, "")
		.replace(UNSUPPORTED_FORMAT_CHARACTER, (character) =>
			preserveParagraphs && character === "\n" ? "\n" : "",
		)
		.replace(/[ \t]{2,}/gu, " ")
		.replace(/^[ \t]+|[ \t]+$/gmu, "")
		.replace(/\n{3,}/gu, "\n\n")
		.trim();
	return preserveParagraphs
		? normalized
		: normalized.replace(/\n{2,}/gu, "\n");
}

function completeExcerpt(value: string) {
	const sentences = value.match(/[^.!?]+[.!?]+(?:["”’)]*)/gu) ?? [];
	let excerpt = "";
	for (const sentence of sentences) {
		const candidate = `${excerpt} ${sentence.trim()}`.trim();
		if (candidate.length > ZALO_EDITORIAL_DESCRIPTION_LIMIT) break;
		excerpt = candidate;
		if (excerpt.length >= 90) break;
	}
	if (excerpt.length >= 20) return excerpt;

	const firstSentence = (sentences[0] ?? value).trim();
	const safeClause = firstSentence
		.slice(0, ZALO_EDITORIAL_DESCRIPTION_LIMIT - 1)
		.replace(/\s+\S*$/u, "")
		.replace(/[,;:–—-][^,;:–—-]*$/u, "")
		.replace(/[,:;–—\s-]+$/u, "")
		.trim();
	if (safeClause.length < 20) return "";
	return `${safeClause}.`;
}

function stripLeadingTitle(value: string, title: string) {
	const titleTokens = comparableText(title).split(/\s+/u).filter(Boolean);
	if (!titleTokens.length) return value;
	const titlePattern = titleTokens
		.map(escapeRegExp)
		.join(String.raw`[^\p{L}\p{N}]+`);
	return value
		.replace(
			new RegExp(
				String.raw`^[^\p{L}\p{N}]*${titlePattern}[^\p{L}\p{N}]*`,
				"iu",
			),
			"",
		)
		.trim();
}

function comparableText(value: string) {
	return value
		.normalize("NFKC")
		.toLocaleLowerCase("vi-VN")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

function truncateAtWord(value: string, limit: number) {
	if (value.length <= limit) return value;
	const sliced = value.slice(0, limit + 1);
	const lastSpace = sliced.lastIndexOf(" ");
	return (lastSpace > limit * 0.6 ? sliced.slice(0, lastSpace) : value.slice(0, limit))
		.trim();
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}
