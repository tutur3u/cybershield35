"use client";

import { Bot, Check, LoaderCircle, Sparkles } from "lucide-react";

import type { ArticleContent } from "@/lib/articles/schemas";

import {
	Field,
	inputClass,
	modelLabel,
	primaryButton,
	Section,
	secondaryButton,
	smallButton,
	textareaClass,
} from "./shared";
import type { AiProposal, EditorialIntent } from "./types";

const INTENTS = [
	[
		"counter_argument",
		"Phản bác quan điểm",
		"Chỉ ra điểm chưa thuyết phục và lập luận đối chiếu",
	],
	["support", "Ủng hộ quan điểm", "Củng cố quan điểm bằng bằng chứng đã chọn"],
	["balanced", "Trình bày cân bằng", "Nêu dữ kiện, khoảng trống và các góc nhìn"],
] as const;

const ACTIONS = [
	["draft", "Viết bản đầu"],
	["outline", "Tạo dàn ý"],
	["rewrite", "Viết lại"],
	["shorten", "Rút gọn"],
	["expand", "Mở rộng"],
	["title_description", "Tiêu đề & mô tả"],
	["claim_check", "Kiểm tra luận điểm"],
] as const;

export function AiPanel({
	busy,
	editorialIntent,
	instruction,
	model,
	models,
	onAsk,
	onEditorialIntentChange,
	onInstructionChange,
	onModelChange,
	onToneChange,
	onVoiceChange,
	tone,
	voice,
}: {
	busy: string;
	editorialIntent: EditorialIntent;
	instruction: string;
	model: string;
	models: { defaultModel: string; models: string[] } | undefined;
	onAsk: (action: string) => void;
	onEditorialIntentChange: (value: EditorialIntent) => void;
	onInstructionChange: (value: string) => void;
	onModelChange: (value: string) => void;
	onToneChange: (value: string) => void;
	onVoiceChange: (value: string) => void;
	tone: string;
	voice: string;
}) {
	return (
		<Section
			description="AI chỉ tạo đề xuất. Nội dung bài chỉ thay đổi khi bạn bấm Áp dụng."
			icon={Bot}
			title="Biên tập bằng AI"
		>
			<div className="grid gap-4">
				<Field
					hint="Chọn hướng viết để AI không mặc định tóm tắt lại nguồn."
					label="Mục tiêu bài viết"
				>
					<div className="grid gap-2 sm:grid-cols-3">
						{INTENTS.map(([value, label, description]) => (
							<button
								key={value}
								type="button"
								aria-pressed={editorialIntent === value}
								onClick={() => onEditorialIntentChange(value)}
								className={`rounded-lg border p-3 text-left transition ${
									editorialIntent === value
										? "border-[var(--brand)] bg-[var(--success-soft)] text-[var(--foreground)]"
										: "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
								}`}
							>
								<span className="block text-[12px] font-bold">{label}</span>
								<span className="mt-1 block text-[11px] leading-4 text-[var(--muted)]">
									{description}
								</span>
							</button>
						))}
					</div>
				</Field>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field hint="Cách bài viết thể hiện thái độ." label="Giọng điệu">
						<input
							value={tone}
							onChange={(event) => onToneChange(event.target.value)}
							className={inputClass}
						/>
					</Field>
					<Field hint="Cảm giác khi đọc câu chữ." label="Văn phong">
						<input
							value={voice}
							onChange={(event) => onVoiceChange(event.target.value)}
							className={inputClass}
						/>
					</Field>
				</div>
				<Field hint="Dùng mô hình dùng chung của workspace." label="Mô hình AI">
					<select
						value={model || models?.defaultModel || ""}
						onChange={(event) => onModelChange(event.target.value)}
						className={inputClass}
					>
						{models?.models.map((item) => (
							<option key={item} value={item}>
								{modelLabel(item)}
							</option>
						))}
					</select>
				</Field>
				<Field
					hint="Không bắt buộc. Càng cụ thể thì đề xuất càng sát ý bạn."
					label="Yêu cầu biên tập"
				>
					<textarea
						value={instruction}
						onChange={(event) => onInstructionChange(event.target.value)}
						rows={3}
						className={textareaClass}
						placeholder="Ví dụ: Mở đầu gần gũi hơn, giữ nguyên mọi số liệu…"
					/>
				</Field>
			</div>
			<div className="mt-4 border-t border-[var(--border)] pt-4">
				<p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
					Thao tác
				</p>
				<div className="mt-2 flex flex-wrap gap-2">
					{ACTIONS.map(([action, label]) => (
						<button
							key={action}
							type="button"
							disabled={Boolean(busy)}
							onClick={() => onAsk(action)}
							className={smallButton}
						>
							{busy === `ai:${action}` ? (
								<LoaderCircle size={13} className="animate-spin" />
							) : (
								<Sparkles size={13} />
							)}
							{label}
						</button>
					))}
				</div>
			</div>
		</Section>
	);
}

export function AiProposalReview({
	current,
	onApply,
	onReject,
	pending,
	proposal,
}: {
	current: ArticleContent;
	onApply: () => void;
	onReject: () => void;
	pending: boolean;
	proposal: AiProposal;
}) {
	return (
		<div className="mt-4 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-[13px] font-bold text-[var(--accent-strong)]">
						Đề xuất AI đang chờ duyệt
					</p>
					<p className="mt-1 text-[11px] text-[var(--muted)]">
						Không thay đổi nội dung cho đến khi bạn chọn Áp dụng.
					</p>
				</div>
				<Sparkles size={18} className="text-[var(--accent-strong)]" />
			</div>
			<div className="mt-3 grid gap-3 lg:grid-cols-2">
				<ProposalColumn
					body={textOf(current)}
					label="Hiện tại"
					title={current.title || "Chưa có tiêu đề"}
				/>
				<ProposalColumn
					accent
					body={textOf(proposal)}
					label="Đề xuất"
					title={proposal.title}
				/>
			</div>
			{proposal.reviewNotes.length ? (
				<ul className="mt-3 space-y-1 text-[11px] leading-5 text-[var(--muted-strong)]">
					{proposal.reviewNotes.map((note) => (
						<li key={note}>• {note}</li>
					))}
				</ul>
			) : null}
			<div className="mt-3 flex gap-2">
				<button type="button" onClick={onApply} disabled={pending} className={primaryButton}>
					{pending ? (
						<LoaderCircle size={14} className="animate-spin" />
					) : (
						<Check size={14} />
					)}
					Áp dụng
				</button>
				<button
					type="button"
					onClick={onReject}
					disabled={pending}
					className={secondaryButton}
				>
					Bỏ qua
				</button>
			</div>
		</div>
	);
}

function ProposalColumn({
	accent = false,
	body,
	label,
	title,
}: {
	accent?: boolean;
	body: string;
	label: string;
	title: string;
}) {
	return (
		<div
			className={`rounded-lg border bg-[var(--surface)] p-3 ${
				accent ? "border-[var(--accent)]" : "border-[var(--border)]"
			}`}
		>
			<p
				className={`text-[10px] font-bold uppercase ${
					accent ? "text-[var(--accent-strong)]" : "text-[var(--muted)]"
				}`}
			>
				{label}
			</p>
			<p className="mt-2 text-[12px] font-bold">{title}</p>
			<p className="mt-1 line-clamp-[10] whitespace-pre-wrap text-[11px] leading-5 text-[var(--muted)]">
				{body}
			</p>
		</div>
	);
}

function textOf(content: ArticleContent) {
	return content.blocks
		.filter((block) => block.type === "text")
		.map((block) => (block.type === "text" ? block.content : ""))
		.join("\n\n");
}
