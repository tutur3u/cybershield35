import { generateText, Output } from "ai";
import { z } from "zod";

import { fitTextToLimit, isCleanlyFitted } from "@/lib/domain/text-fit";
import { getRiskModelRuntime } from "@/lib/llm/generation";

export type FittedHeadline = {
	description: string;
	source: "already-fits" | "deterministic" | "llm";
	title: string;
};

const headlineSchema = z.object({
	description: z.string().trim().min(1).max(1_000),
	title: z.string().trim().min(1).max(400),
});

const summarySchema = z.object({
	summary: z.string().trim().min(1).max(1_000),
});

const MAX_ATTEMPTS = 2;

/**
 * Rewrites an article's title and excerpt so they fit their caps as complete,
 * natural sentences.
 *
 * Truncation is the wrong tool for a headline: cutting "Chính phủ công bố chính
 * sách hỗ trợ học phí cho sinh viên vùng khó khăn" at 110 characters leaves the
 * reader with a fragment. Asking the model to *say the same thing shorter* keeps
 * the meaning and the grammar. `fitTextToLimit` is the floor when no model is
 * configured, when the call fails, or when the model still overshoots.
 */
export async function fitArticleHeadline(input: {
	body?: string;
	description: string;
	descriptionLimit: number;
	/** Rewrite even when the current text already fits, for editorial clean-ups. */
	rewriteEvenIfFitting?: boolean;
	title: string;
	titleLimit: number;
}): Promise<FittedHeadline> {
	const title = input.title.trim();
	const description = input.description.trim();
	if (
		!input.rewriteEvenIfFitting &&
		isCleanlyFitted(title, input.titleLimit) &&
		isCleanlyFitted(description, input.descriptionLimit)
	) {
		return { description, source: "already-fits", title };
	}

	const runtime = getRiskModelRuntime();
	if (runtime) {
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
			try {
				const { output } = await generateText({
					model: runtime.model,
					output: Output.object({ schema: headlineSchema }),
					prompt: JSON.stringify({
						attempt,
						body: input.body?.slice(0, 4_000),
						currentDescription: description,
						currentTitle: title,
						goal: input.rewriteEvenIfFitting
							? "Viết lại thành tiêu đề và trích yếu biên tập chuẩn, bỏ mọi dấu hiệu sao chép nguyên văn từ mạng xã hội."
							: "Rút gọn cho vừa giới hạn mà vẫn trọn ý.",
						limits: {
							description: input.descriptionLimit,
							title: input.titleLimit,
						},
						task: "Viết lại tiêu đề và trích yếu sao cho vừa giới hạn ký tự mà vẫn là câu hoàn chỉnh.",
					}),
					system: HEADLINE_SYSTEM_PROMPT,
					temperature: attempt === 1 ? 0.2 : 0,
				});
				const fittedTitle = collapse(output.title);
				const fittedDescription = collapse(output.description);
				if (
					isCleanlyFitted(fittedTitle, input.titleLimit) &&
					isCleanlyFitted(fittedDescription, input.descriptionLimit)
				) {
					return {
						description: fittedDescription,
						source: "llm",
						title: fittedTitle,
					};
				}
			} catch {
				break;
			}
		}
	}

	return {
		description:
			fitTextToLimit(description, input.descriptionLimit, {
				preferredLength: Math.floor(input.descriptionLimit * 0.55),
			}) || description.slice(0, input.descriptionLimit).trim(),
		source: "deterministic",
		title:
			fitTextToLimit(title, input.titleLimit) ||
			title.slice(0, input.titleLimit).trim(),
	};
}

/**
 * Condenses a long passage into a standalone summary that fits `limit` without
 * being cut off. Used for evidence excerpts shown on the timeline.
 */
export async function fitSummary(
	value: string,
	limit: number,
): Promise<{ source: FittedHeadline["source"]; summary: string }> {
	const summary = value.trim();
	if (isCleanlyFitted(summary, limit)) {
		return { source: "already-fits", summary };
	}

	const runtime = getRiskModelRuntime();
	if (runtime) {
		try {
			const { output } = await generateText({
				model: runtime.model,
				output: Output.object({ schema: summarySchema }),
				prompt: JSON.stringify({
					limit,
					task: "Tóm tắt nội dung sau thành một hoặc hai câu hoàn chỉnh, không vượt quá giới hạn ký tự.",
					text: summary.slice(0, 6_000),
				}),
				system: SUMMARY_SYSTEM_PROMPT,
				temperature: 0,
			});
			const fitted = collapse(output.summary);
			if (isCleanlyFitted(fitted, limit)) {
				return { source: "llm", summary: fitted };
			}
		} catch {
			// Fall through to the deterministic trim below.
		}
	}

	return {
		source: "deterministic",
		summary:
			fitTextToLimit(summary, limit, {
				preferredLength: Math.floor(limit * 0.6),
			}) || summary.slice(0, limit).trim(),
	};
}

function collapse(value: string) {
	return value.replace(/\s+/gu, " ").trim();
}

const HEADLINE_SYSTEM_PROMPT = `Bạn là biên tập viên tiếng Việt. Nhiệm vụ của bạn là rút gọn tiêu đề và trích yếu cho vừa giới hạn ký tự, KHÔNG phải cắt bớt chúng.

Nguyên tắc bắt buộc:
- Giữ nguyên ý chính, sự kiện, chủ thể và số liệu quan trọng. Không thêm thông tin mới, không suy diễn.
- Tiêu đề là một dòng hoàn chỉnh, tự nhiên, cụ thể, không giật gân, không kết thúc bằng dấu ba chấm.
- Trích yếu gồm một đến hai câu hoàn chỉnh, có dấu chấm cuối câu, tóm tắt điều người đọc sẽ nhận được.
- Trích yếu không được lặp lại nguyên văn tiêu đề.
- Tuyệt đối không kết thúc bằng từ nối như “và”, “của”, “với”, “để”, “trong”, “về”, “theo”.
- Không dùng emoji, biểu tượng trang trí hay ký hiệu trích dẫn dạng [1].
- Viết ngắn hơn giới hạn vài ký tự để chắc chắn vừa; đếm ký tự trước khi trả về.
- Nếu văn bản gốc đã bị cắt giữa chừng, hãy viết lại thành câu trọn vẹn dựa trên phần nội dung có sẵn.`;

const SUMMARY_SYSTEM_PROMPT = `Bạn là biên tập viên tiếng Việt. Tóm tắt nội dung được cung cấp thành một hoặc hai câu hoàn chỉnh, trung lập, đúng sự việc.

Nguyên tắc bắt buộc:
- Không vượt quá giới hạn ký tự; viết ngắn hơn vài ký tự cho chắc chắn.
- Câu phải trọn vẹn và kết thúc bằng dấu chấm. Không kết thúc bằng dấu ba chấm hoặc từ nối.
- Chỉ dùng thông tin có trong văn bản gốc. Không suy diễn về danh tính hay động cơ.
- Không dùng emoji hoặc ký tự trang trí.`;
