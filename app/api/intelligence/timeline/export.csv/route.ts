import { ZodError } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { listTimeline } from "@/lib/dashboard/timeline-server";
import { parseTimelineSearchParams } from "@/lib/dashboard/timeline-query";

const EXPORT_LIMIT = 50_000;
const BATCH_SIZE = 50;

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const { filters } = parseTimelineSearchParams(new URL(request.url).searchParams);
		const first = await listTimeline({ filters, limit: BATCH_SIZE });
		if (first.total > EXPORT_LIMIT) {
			return Response.json(
				{ error: `Bộ lọc có ${first.total.toLocaleString("vi-VN")} dòng, vượt giới hạn ${EXPORT_LIMIT.toLocaleString("vi-VN")}.` },
				{ headers: authHeaders(auth), status: 422 },
			);
		}
		const responseHeaders = new Headers(authHeaders(auth));
		responseHeaders.set("Content-Disposition", `attachment; filename="dong-thoi-gian-${new Date().toISOString().slice(0, 10)}.csv"`);
		responseHeaders.set("Content-Type", "text/csv; charset=utf-8");
		responseHeaders.set("Cache-Control", "private, no-store");
		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				const encoder = new TextEncoder();
				controller.enqueue(encoder.encode(`\uFEFF${csvRow([
					"Mã bằng chứng", "Thời gian đăng", "Nguồn", "Tác giả", "Nội dung", "Nhà cung cấp", "Rủi ro", "Cảm xúc", "Lập trường", "Lượt tương tác", "Chủ đề", "Trạng thái xử lý", "Người phụ trách", "Hạn xử lý", "Ghim đội ngũ", "Liên kết gốc",
				])}\r\n`));
				let page = first;
				let written = 0;
				while (true) {
					for (const item of page.items) {
						controller.enqueue(encoder.encode(`${csvRow([
							item.id, item.publishedAt ?? item.createdAt, item.sourceLabel ?? "", item.author ?? "", item.quote, item.provider, item.riskLevel, item.sentiment, item.stance, item.engagement.total, item.topicSlugs.join(" | "), item.triage.status, item.triage.assigneeDisplayName ?? "", item.triage.dueAt ?? "", item.triage.isPinned ? "Có" : "Không", item.originalPostHref ?? "",
						])}\r\n`));
						written += 1;
					}
					if (!page.nextCursor || written >= EXPORT_LIMIT) break;
					page = await listTimeline({ cursor: page.nextCursor, filters, limit: BATCH_SIZE });
				}
				controller.close();
			},
		});
		return new Response(stream, { headers: responseHeaders });
	} catch (error) {
		return Response.json(
			{ error: error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Không thể xuất CSV." },
			{ headers: authHeaders(auth), status: error instanceof ZodError ? 400 : 503 },
		);
	}
}

export function csvRow(values: Array<number | string>) {
	return values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",");
}
