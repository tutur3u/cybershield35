import { NoObjectGeneratedError } from "ai";
import { hasEditorialPlaceholder, publicWritingIssues, readerFacingStyleIssues } from "@/lib/articles/draft-quality";

import type { ArticleContent } from "@/lib/articles/schemas";
import { cleanDraftContent } from "@/lib/domain/draft-content";
import type { ArticleAiOutput } from "@/lib/llm/schemas";

// Check generated prose, never alter a user's manually authored article.
const SENTENCE_END = /[.!?]["”’')\]]*$/u;
const BODY_ACTIONS = new Set(["draft", "rewrite", "shorten", "expand"]);

export class ArticleGenerationError extends Error {
	constructor() {
		super("AI chưa tạo được bài viết hoàn chỉnh. Vui lòng thử lại.");
		this.name = "ArticleGenerationError";
	}
}

export function articleCompletionIssues(
	content: ArticleContent,
	action: string,
): string[] {
	const issues: string[] = [];
	if (
		!content.title.trim() ||
		content.title.length > 150 ||
		/[…]|\.{3}$/u.test(content.title)
	) {
		issues.push(
			"Viết tiêu đề trọn ý trong 150 ký tự, không cắt ngắn bằng dấu ba chấm.",
		);
	}
	if (
		action !== "outline" &&
		(!SENTENCE_END.test(content.description.trim()) ||
			content.description.length > 300 ||
			hasEditorialPlaceholder(content.description))
	) {
		issues.push(
			"Viết trích yếu thành câu hoàn chỉnh trong 300 ký tự, không có chỗ trống.",
		);
	}
	if (!BODY_ACTIONS.has(action)) {
		if (action === "description" || action === "title_description") {
			issues.push(...readerFacingStyleIssues({
				...content,
				title: action === "description" ? "" : content.title,
				blocks: [],
			}));
		}
		return issues;
	}
	issues.push(...publicWritingIssues(content));
	const paragraphs = content.blocks.flatMap((block) =>
		block.type === "text"
			? block.content
					.split(/\n+/u)
					.map((line) => line.trim())
					.filter(Boolean)
			: [],
	);
	if (!paragraphs.length || (action === "draft" && paragraphs.length < 2)) {
		issues.push(
			"Viết thân bài hoàn chỉnh gồm mở bài, nội dung và kết luận, chia thành các đoạn rõ ý.",
		);
	}
	if (paragraphs.some((paragraph) => hasEditorialPlaceholder(paragraph))) {
		issues.push(
			"Thay mọi lời hẹn biên tập, yêu cầu người viết bổ sung và chỗ trống bằng nội dung hoàn chỉnh có căn cứ.",
		);
	}
	if (
		paragraphs.some((paragraph, index) => {
			// A short heading is allowed before prose; the final line must be a sentence.
			const heading =
				index < paragraphs.length - 1 &&
				paragraph.length <= 80 &&
				(/^(?:#{1,6}\s|\*\*)/u.test(paragraph) || /:$/u.test(paragraph));
			// A labelled source URL is a reference, not an unfinished sentence.
			const sourceLink = /^(?:Nguồn|Tham khảo):\s*[^\n]{0,100}?https?:\/\/[^\s]+$/iu.test(paragraph);
			return (
				!heading && !sourceLink &&
				(!SENTENCE_END.test(paragraph) ||
					/(?:…|\.{3})["”’')\]]*$/u.test(paragraph))
			);
		})
	) {
		issues.push(
			"Viết lại các đoạn bị cắt dở thành câu trọn ý, kể cả trong trích dẫn; không chỉ thêm dấu chấm vào mảnh câu.",
		);
	}
	return issues;
}

/** One fresh, bounded repair from the original evidence, with no partial writes. */
export async function generateCompleteArticle(
	action: string,
	generate: (
		repairInstructions: string[],
		attempt: number,
	) => Promise<{ output: ArticleAiOutput; finishReason: string; additionalIssues?: string[] }>,
): Promise<ArticleAiOutput> {
	let issues: string[] = [];
	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			const result = await generate(issues, attempt);
			const output = {
				...result.output,
				author: cleanDraftContent(result.output.author),
				blocks: result.output.blocks.map((block) =>
					block.type === "text"
						? { ...block, content: cleanDraftContent(block.content) }
						: block,
				),
				description: cleanDraftContent(result.output.description),
				title: cleanDraftContent(result.output.title),
			};
			issues = [...articleCompletionIssues(output, action), ...(result.additionalIssues ?? [])];
			if (result.finishReason !== "stop") {
				issues.push(
					"Hoàn thành toàn bộ JSON và bài viết trong giới hạn đầu ra; viết ngắn hơn nếu cần.",
				);
			}
			if (!issues.length) return output;
			console.warn("[article-generation:incomplete]", {
				action,
				attempt: attempt + 1,
				finishReason: result.finishReason,
				issues,
			});
		} catch (error) {
			// Authentication, billing and transport errors are not content-repair problems.
			if (!NoObjectGeneratedError.isInstance(error)) throw error;
			console.warn("[article-generation:invalid-output]", {
				action,
				attempt: attempt + 1,
				finishReason: error.finishReason,
				cause: error.cause instanceof Error ? error.cause.name : undefined,
			});
			issues = [
				"Trả về toàn bộ bài viết hoàn chỉnh theo đúng JSON schema, không bỏ dở đầu ra.",
			];
		}
	}
	throw new ArticleGenerationError();
}
