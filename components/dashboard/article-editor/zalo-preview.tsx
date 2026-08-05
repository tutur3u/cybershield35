"use client";

import { Check, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";

import {
	ImagePlaceholder,
	SafeImage,
} from "@/components/dashboard/safe-image";
import type { ArticleContent } from "@/lib/articles/schemas";

import { ZALO_OA_MANAGER_URL, zaloArticleEditorUrl } from "./shared";

export function ZaloPreview({
	content,
	onCoverUnavailable,
}: {
	content: ArticleContent;
	onCoverUnavailable?: () => void;
}) {
	return (
		<article className="overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm">
			<SafeImage
				alt=""
				className="aspect-[16/9] w-full object-cover"
				fallback={
					<ImagePlaceholder className="aspect-[16/9] w-full rounded-none border-0 text-[12px] font-bold">
						Chưa có ảnh bìa
					</ImagePlaceholder>
				}
				height={540}
				onUnavailable={onCoverUnavailable}
				priority
				src={content.coverUrl}
				width={960}
			/>
			<div className="p-4">
				<p className="text-[10px] font-bold uppercase tracking-wide text-[#0068ff]">
					Bản xem trước trên Zalo
				</p>
				<h3 className="mt-2 text-base font-bold leading-6">
					{content.title || "Tiêu đề bài viết"}
				</h3>
				<p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
					{content.description || "Mô tả bài viết sẽ hiển thị tại đây."}
				</p>
				<div className="mt-4 space-y-3">
					{content.blocks.map((block) =>
						block.type === "text" ? (
							block.content.trim() ? (
								<p
									key={block.id}
									className="whitespace-pre-wrap text-[12px] leading-5 text-[var(--muted-strong)]"
								>
									{block.content}
								</p>
							) : null
						) : (
							<figure key={block.id}>
								<SafeImage
									alt={block.caption ?? ""}
									className="h-auto w-full rounded-md"
									fallback={null}
									height={540}
									src={block.url}
									width={960}
								/>
								{block.caption ? (
									<figcaption className="mt-1 text-[11px] text-[var(--muted)]">
										{block.caption}
									</figcaption>
								) : null}
							</figure>
						),
					)}
				</div>
			</div>
		</article>
	);
}

export function ZaloDashboardHandoff({
	oaDisplayName,
	oaId,
	publicationStatus,
	remoteArticleId,
	synced,
}: {
	oaDisplayName: string | null;
	oaId: string | null;
	publicationStatus: string;
	remoteArticleId: string | null;
	synced: boolean;
}) {
	if (!remoteArticleId) {
		return (
			<div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-3">
				<p className="text-[12px] font-bold text-[var(--muted-strong)]">
					Chưa có bản nháp trên Zalo
				</p>
				<p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
					Tạo bản ẩn để kiểm tra trực tiếp trong Zalo OA. Bài chỉ có thể xuất bản công
					khai sau khi được phê duyệt.
				</p>
			</div>
		);
	}

	const published = publicationStatus === "published";
	const editorUrl = zaloArticleEditorUrl(remoteArticleId);
	return (
		<div
			className={`rounded-lg border p-3 ${
				synced
					? "border-[#0068ff]/25 bg-[#0068ff]/5"
					: "border-[var(--warning-border)] bg-[var(--warning-soft)]"
			}`}
		>
			<div className="flex items-start gap-2.5">
				<span
					className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${
						synced
							? "bg-[#0068ff] text-white"
							: "bg-[var(--surface)] text-[var(--warning-strong)]"
					}`}
				>
					{synced ? <Check size={14} /> : <RefreshCw size={13} />}
				</span>
				<div className="min-w-0">
					<p className="text-[12px] font-bold text-[var(--foreground)]">
						{synced
							? published
								? "Bài đang hiển thị trên Zalo"
								: "Bản ẩn đã có trên Zalo"
							: "Bản Zalo cần đồng bộ lại"}
					</p>
					<p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
						{oaDisplayName ?? "Zalo Official Account"}
						{oaId ? ` · OA ${oaId}` : ""}
					</p>
				</div>
			</div>
			<a
				href={editorUrl ?? ZALO_OA_MANAGER_URL}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={`Mở bài viết trong trình soạn thảo Zalo OA${oaDisplayName ? ` của ${oaDisplayName}` : ""}`}
				className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-lg bg-[#0068ff] px-3 py-2 text-left text-white transition hover:bg-[#005ae0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0068ff]/40"
			>
				<ExternalLink size={15} className="shrink-0" />
				<span className="min-w-0 flex-1">
					<span className="block text-[11px] font-bold">
						{editorUrl ? "Mở trong trình soạn thảo Zalo" : "Mở trong Zalo OA"}
					</span>
					<span className="mt-0.5 block text-[10px] leading-4 text-white/80">
						{editorUrl
							? "Đi thẳng tới đúng bài viết này"
							: "Đi thẳng tới danh sách Nội dung → Bài viết"}
					</span>
				</span>
				<ChevronRight size={15} className="shrink-0" />
			</a>
		</div>
	);
}
