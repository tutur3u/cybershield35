"use client";

import { FileText, ImagePlus, Plus, Type } from "lucide-react";
import { useState } from "react";

import type { ArticleContent } from "@/lib/articles/schemas";
import {
	ZALO_EDITORIAL_DESCRIPTION_LIMIT,
	ZALO_EDITORIAL_TITLE_LIMIT,
} from "@/lib/zalo/article-content";

import { BlockEditor } from "./block-editor";
import { MediaField } from "./media-fields";
import {
	countWords,
	duplicateBlock,
	Field,
	inputClass,
	insertBlock,
	moveBlock,
	Section,
	smallButton,
	textareaClass,
	ToggleRow,
} from "./shared";

export function ComposePanel({
	articleId,
	draft,
	onChange,
	onCoverUnavailable,
	onImageBlockUnavailable,
}: {
	articleId: string;
	draft: ArticleContent;
	onChange: (next: ArticleContent) => void;
	onCoverUnavailable: () => void;
	onImageBlockUnavailable: (blockId: string) => void;
}) {
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dropIndex, setDropIndex] = useState<number | null>(null);

	function reorder(from: number, to: number) {
		if (from === to) return;
		const blocks = [...draft.blocks];
		const [moved] = blocks.splice(from, 1);
		if (!moved) return;
		blocks.splice(to, 0, moved);
		onChange({ ...draft, blocks });
	}

	return (
		<div className="space-y-4">
			<Section
				description="Những trường này quyết định bài hiển thị thế nào trong danh sách và trên Zalo OA."
				icon={FileText}
				title="Thông tin bài viết"
			>
				<div className="grid gap-4">
					<Field
						count={`${draft.title.length}/${ZALO_EDITORIAL_TITLE_LIMIT}`}
						hint="Ngắn gọn, nêu đúng trọng tâm, không lặp lại trích yếu."
						label="Tiêu đề"
					>
						<input
							value={draft.title}
							maxLength={ZALO_EDITORIAL_TITLE_LIMIT}
							onChange={(event) => onChange({ ...draft, title: event.target.value })}
							className={`${inputClass} h-12 text-[15px] font-bold`}
							placeholder="Ví dụ: Làm rõ thông tin đang lan truyền về…"
						/>
					</Field>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field
							count={`${draft.author.length}/50`}
							hint="Tên đơn vị hoặc bút danh hiển thị cuối bài."
							label="Tác giả"
						>
							<input
								value={draft.author}
								maxLength={50}
								onChange={(event) => onChange({ ...draft, author: event.target.value })}
								className={inputClass}
								placeholder="CyberShield35"
							/>
						</Field>
						<Field
							hint="Cho phép người đọc bình luận dưới bài trên Zalo OA."
							label="Bình luận"
						>
							<ToggleRow
								checked={draft.commentsEnabled}
								label={draft.commentsEnabled ? "Đang bật" : "Đang tắt"}
								onChange={(next) => onChange({ ...draft, commentsEnabled: next })}
							/>
						</Field>
					</div>
					<Field
						count={`${draft.description.length}/${ZALO_EDITORIAL_DESCRIPTION_LIMIT}`}
						hint="Một đến hai câu hoàn chỉnh tóm tắt nội dung; đây là đoạn hiển thị khi chia sẻ."
						label="Trích yếu"
					>
						<textarea
							value={draft.description}
							maxLength={ZALO_EDITORIAL_DESCRIPTION_LIMIT}
							rows={3}
							onChange={(event) =>
								onChange({ ...draft, description: event.target.value })
							}
							className={textareaClass}
							placeholder="Tóm tắt điều người đọc sẽ nhận được sau khi đọc bài."
						/>
					</Field>
					<Field
						hint="Ảnh ngang 16:9 hiển thị đầu bài và khi chia sẻ. Ảnh hỏng sẽ tự động được gỡ."
						label="Ảnh bìa"
					>
						<MediaField
							articleId={articleId}
							onChange={(url) => onChange({ ...draft, coverUrl: url })}
							onUnavailable={onCoverUnavailable}
							url={draft.coverUrl ?? null}
						/>
					</Field>
				</div>
			</Section>

			<Section
				description={`${draft.blocks.length} khối · ${countWords(draft)} từ · kéo khối để đổi thứ tự`}
				icon={Type}
				title="Nội dung"
			>
				<div className="space-y-3">
					{draft.blocks.length ? (
						draft.blocks.map((block, index) => (
							<BlockEditor
								articleId={articleId}
								key={block.id}
								block={block}
								index={index}
								count={draft.blocks.length}
								dragging={dragIndex === index}
								dropTarget={dropIndex === index && dragIndex !== index}
								onDragEnd={() => {
									setDragIndex(null);
									setDropIndex(null);
								}}
								onDragOver={(event) => {
									event.preventDefault();
									if (dragIndex !== null) setDropIndex(index);
								}}
								onDragStart={(event) => {
									event.dataTransfer.effectAllowed = "move";
									setDragIndex(index);
								}}
								onDrop={(event) => {
									event.preventDefault();
									if (dragIndex !== null) reorder(dragIndex, index);
									setDragIndex(null);
									setDropIndex(null);
								}}
								onChange={(next) =>
									onChange({
										...draft,
										blocks: draft.blocks.map((item) =>
											item.id === block.id ? next : item,
										),
									})
								}
								onDuplicate={() =>
									onChange({
										...draft,
										blocks: insertBlock(draft.blocks, index + 1, duplicateBlock(block)),
									})
								}
								onImageUnavailable={() => onImageBlockUnavailable(block.id)}
								onMove={(direction) =>
									onChange({
										...draft,
										blocks: moveBlock(draft.blocks, index, direction),
									})
								}
								onRemove={() =>
									onChange({
										...draft,
										blocks: draft.blocks.filter((item) => item.id !== block.id),
									})
								}
							/>
						))
					) : (
						<div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
							<Type size={22} className="mx-auto text-[var(--muted)]" />
							<p className="mt-2 text-[13px] font-bold text-[var(--foreground)]">
								Bài viết chưa có nội dung
							</p>
							<p className="mt-1 text-[12px] text-[var(--muted)]">
								Thêm khối văn bản để bắt đầu, hoặc dùng tab “AI hỗ trợ” để viết bản đầu
								từ bằng chứng.
							</p>
						</div>
					)}
					<div className="flex flex-wrap gap-2 pt-1">
						<button
							type="button"
							onClick={() =>
								onChange({
									...draft,
									blocks: [
										...draft.blocks,
										{ content: "", id: crypto.randomUUID(), type: "text" },
									],
								})
							}
							className={smallButton}
						>
							<Plus size={13} /> Thêm khối văn bản
						</button>
						<button
							type="button"
							onClick={() =>
								onChange({
									...draft,
									blocks: [
										...draft.blocks,
										{ id: crypto.randomUUID(), type: "image", url: "" },
									],
								})
							}
							className={smallButton}
						>
							<ImagePlus size={13} /> Thêm ảnh
						</button>
					</div>
				</div>
			</Section>
		</div>
	);
}
