import type { ArticleContent } from "./schemas";

const PLACEHOLDER =
	/(?:\b(?:TODO|TBD)\b|\[(?:insert|add|write|bổ sung|viết|thêm)[^\]]*\]|(?:biên tập viên|người viết|tác giả)\s+(?:sẽ|cần|phải)\s+(?:hoàn thiện|bổ sung|viết tiếp)|(?:phân tích|kết luận|nội dung)\s+(?:sẽ được|cần được)\s+(?:(?:biên tập viên|người viết|tác giả)\s+)?(?:bổ sung|hoàn thiện)|(?:writer|editor)\s+(?:will|should|must|needs to)\s+(?:complete|finish|add))/iu;

export function hasEditorialPlaceholder(text: string): boolean {
    return PLACEHOLDER.test(text);
}

/** Conservative checks shared by generation and recovery of legacy templates. */
export function publicWritingIssues(content: ArticleContent): string[] {
    const text = [content.description, ...content.blocks.flatMap(block => block.type === "text" ? [block.content] : [])].join("\n");
    const issues: string[] = [];
    if (hasEditorialPlaceholder(text)) issues.push("Hoàn thiện nội dung còn để trống hoặc hẹn biên tập viên viết tiếp.");
    if (/(?:^|\n)\s*(?:Trích nội dung gốc:|Dựa trên (?:các )?bằng chứng được cung cấp|Bài viết (?:này )?(?:phân tích|sẽ trình bày)|Thông tin đang lan truyền cần được đối chiếu lại với dữ kiện đã ghi nhận)/iu.test(text)) {
        issues.push("Viết trực tiếp cho độc giả: thay lời giới thiệu bài viết, bản trích nguồn và ghi chú nội bộ bằng nội dung báo chí có chủ thể, diễn biến và kết luận cụ thể.");
    }
    return issues;
}
