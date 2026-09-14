import type { ArticleContent } from "./schemas";

const PLACEHOLDER =
	/(?:\b(?:TODO|TBD)\b|\[(?:insert|add|write|bổ sung|viết|thêm)[^\]]*\]|(?:biên tập viên|người viết|tác giả)\s+(?:sẽ|cần|phải)\s+(?:hoàn thiện|bổ sung|viết tiếp)|(?:phân tích|kết luận|nội dung)\s+(?:sẽ được|cần được)\s+(?:(?:biên tập viên|người viết|tác giả)\s+)?(?:bổ sung|hoàn thiện)|(?:writer|editor)\s+(?:will|should|must|needs to)\s+(?:complete|finish|add))/iu;

export function hasEditorialPlaceholder(text: string): boolean {
    return PLACEHOLDER.test(text);
}

/** Narrow editorial regressions, not a general measure of writing quality. */
export function readerFacingStyleIssues(content: ArticleContent): string[] {
    const text = [content.title, content.description, ...content.blocks.flatMap(block => block.type === "text" ? [block.content] : [])].join(" ").normalize("NFC").replace(/\s+/gu, " ");
    if (/hồ sơ hiện có chưa đủ|đọc đủ thông tin trước khi kết luận|cần được bàn từ việc của từng người|theo đạo và bị phạt tù chưa có nghĩa là bị phạt tù vì theo đạo/iu.test(text)) {
        return ["Viết lại câu khuôn mẫu bằng một ý rõ ràng, gần gũi với độc giả; bỏ cách chơi chữ và lời hướng dẫn đọc tin. Giữ quy nguồn đúng chỗ; chuyển việc cần kiểm tra vào reviewNotes. Không chỉ thay vài từ đồng nghĩa."];
    }
    return [];
}

/** Conservative checks shared by generation and recovery of legacy templates. */
export function publicWritingIssues(content: ArticleContent): string[] {
    const text = [content.description, ...content.blocks.flatMap(block => block.type === "text" ? [block.content] : [])].join("\n");
    const issues: string[] = readerFacingStyleIssues(content);
    if (hasEditorialPlaceholder(text)) issues.push("Hoàn thiện nội dung còn để trống hoặc hẹn biên tập viên viết tiếp.");
    if (/(?:^|\n)\s*(?:Trích nội dung gốc:|Dựa trên (?:các )?bằng chứng được cung cấp|Bài viết (?:này )?(?:phân tích|sẽ trình bày)|Thông tin đang lan truyền cần được đối chiếu lại với dữ kiện đã ghi nhận)/iu.test(text)) {
        issues.push("Viết trực tiếp cho độc giả: thay lời giới thiệu bài viết, bản trích nguồn và ghi chú nội bộ bằng nội dung báo chí có chủ thể, diễn biến và kết luận cụ thể.");
    }
    return issues;
}

/** Detect added authority claims; this is a guard, not a factual verification service. */
export function unsupportedAttributionIssues(content: ArticleContent, sourceText: string): string[] {
    const text = [content.title, content.description, ...content.blocks.flatMap(block => block.type === "text" ? [block.content] : [])].join("\n");
    const issues: string[] = [];
    const authority = /(?:chuyên gia|luật sư|nhà nghiên cứu)/iu;
    if (authority.test(text) && !authority.test(sourceText)) {
        issues.push("Nguồn không có ý kiến chuyên gia, luật sư hoặc nhà nghiên cứu. Xóa mọi lời gán cho họ; không thay bằng một nguồn thẩm quyền khác do bạn tự tạo. Chỉ trình bày thông tin và quan điểm thật sự có trong nguồn.");
    }
    for (const timing of [/(?:tuần|tháng|năm)\s+(?:tới|sau)/giu, /(?:hằng|hàng|mỗi)\s+(?:ngày|tuần|tháng|năm)/giu]) {
        const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").replace(/^(?:hằng|hàng|mỗi) /u, "mỗi ");
        const supported = new Set([...sourceText.matchAll(timing)].map(match => normalize(match[0])));
        for (const match of text.matchAll(timing)) {
            if (!supported.has(normalize(match[0]))) issues.push(`Không có căn cứ cho thời điểm hoặc tần suất "${match[0]}". Xóa chi tiết này; giữ đúng thời gian nguồn xác nhận.`);
        }
    }
    return [...new Set(issues)];
}
