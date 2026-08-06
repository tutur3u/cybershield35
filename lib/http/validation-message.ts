import type { ZodError } from "zod";

/**
 * Turns a schema rejection into a sentence a person can act on.
 *
 * These routes used to answer with `z.treeifyError`, so a customer pressing
 * "Lưu và duyệt" was shown
 * `{"errors":[],"properties":{"blocks":{"items":[null,null,{"url":["Invalid URL"]}]}}}`
 * across the top of the editor. It names the failure precisely and tells the
 * reader nothing: not which block, not what to do, not even that it concerns an
 * image. This says where the problem is, in the language of the thing the
 * author is looking at.
 */

const FIELD_LABELS: Record<string, string> = {
	author: "Tác giả",
	blocks: "Nội dung",
	commentsEnabled: "Bình luận",
	coverUrl: "Ảnh bìa",
	description: "Trích yếu",
	targetOaConnectionId: "Zalo OA đích",
	title: "Tiêu đề",
	url: "Đường dẫn ảnh",
};

const ISSUE_MESSAGES: Record<string, string> = {
	invalid_format: "không đúng định dạng",
	invalid_type: "không hợp lệ",
	too_big: "vượt quá độ dài cho phép",
	too_small: "chưa được điền",
	unrecognized_keys: "chứa trường không được hỗ trợ",
};

export function validationMessage(error: ZodError, fallback: string) {
	const issue = error.issues[0];
	if (!issue) return fallback;

	const path = issue.path.filter(
		(part): part is string | number => part !== undefined,
	);
	// The last named segment is the field; a numeric one before it is the
	// position, which is what turns "Nội dung" into "khối nội dung thứ 3".
	const field = [...path].reverse().find((part) => typeof part === "string");
	const index = path.find((part) => typeof part === "number");
	const label = field ? (FIELD_LABELS[field] ?? String(field)) : null;
	const position = typeof index === "number" ? ` thứ ${index + 1}` : "";
	const problem = ISSUE_MESSAGES[issue.code] ?? "không hợp lệ";

	if (!label) return fallback;
	return `${label}${position} ${problem}.`;
}
