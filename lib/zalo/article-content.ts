import type { ArticleContent } from "@/lib/articles/schemas";
import { cleanDraftContent } from "@/lib/domain/draft-content";
import { fitTextToLimit } from "@/lib/domain/text-fit";

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
					? fitTextToLimit(sanitizeZaloText(block.caption, false), 300)
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
		author: fitTextToLimit(sanitizeZaloText(content.author, false), 50),
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
	return fitTextToLimit(title, ZALO_EDITORIAL_TITLE_LIMIT)
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
		// Zalo's manager can collapse a single newline and visually join a
		// heading with the following sentence. Treat every authored line break as
		// a paragraph boundary so the remote preview keeps deliberate spacing.
		.split(/\n+/u)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);
	if (
		paragraphs.length &&
		comparableText(paragraphs[0] ?? "") === comparableText(title)
	) {
		paragraphs.shift();
	}
	if (paragraphs.length > 1 && isStandaloneLeadHeading(paragraphs[0] ?? "")) {
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

function isStandaloneLeadHeading(value: string) {
	if (value.length < 20 || value.length > 180 || /[.!?…:]$/u.test(value)) {
		return false;
	}
	const letters = [...value].filter((character) => /\p{L}/u.test(character));
	if (letters.length < 12) return false;
	const uppercase = letters.filter(
		(character) =>
			character === character.toLocaleUpperCase("vi-VN") &&
			character !== character.toLocaleLowerCase("vi-VN"),
	).length;
	return uppercase / letters.length >= 0.78;
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
	const fitted = fitTextToLimit(value, ZALO_EDITORIAL_DESCRIPTION_LIMIT, {
		minLength: 20,
		preferredLength: 90,
	});
	if (!fitted) return "";
	return /[.!?…]$/u.test(fitted) ? fitted : `${fitted}.`;
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

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}
