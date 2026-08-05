"use client";

import { Bot, Info, LoaderCircle, Wand2 } from "lucide-react";

import { DashboardTooltip } from "@/components/dashboard/ui-primitives";
import type { ArticleContent } from "@/lib/articles/schemas";

import {
	AI_ACTION_GROUPS,
	AI_ACTIONS,
	AI_INSTRUCTION_HINTS,
	AI_INTENTS,
	AI_TONE_PRESETS,
	AI_VOICE_PRESETS,
	type AiAction,
} from "./ai-actions";
import {
	Field,
	inputClass,
	modelLabel,
	Section,
	textareaClass,
} from "./shared";
import type { EditorialIntent } from "./types";

export function AiPanel({
	busy,
	draft,
	editorialIntent,
	evidenceCount,
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
	draft: ArticleContent;
	editorialIntent: EditorialIntent;
	evidenceCount: number;
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
	const hasBody = draft.blocks.some(
		(block) => block.type === "text" && block.content.trim().length > 40,
	);
	const running = busy.startsWith("ai:");

	return (
		<div className="space-y-4">
			<Section
				description={
					evidenceCount
						? `AI viết dựa trên ${evidenceCount} dẫn chứng đã gắn vào bài. Mọi đề xuất đều chờ bạn duyệt.`
						: "Bài chưa gắn dẫn chứng nào — AI sẽ chỉ dựa trên nội dung bạn đã viết."
				}
				icon={Bot}
				title="Trợ lý biên tập"
			>
				<Field
					hint="Quyết định hướng lập luận của bài. Áp dụng cho mọi thao tác bên dưới."
					label="Mục tiêu bài viết"
				>
					<div className="grid gap-2 sm:grid-cols-3">
						{AI_INTENTS.map((intent) => (
							<button
								key={intent.value}
								type="button"
								aria-pressed={editorialIntent === intent.value}
								onClick={() => onEditorialIntentChange(intent.value)}
								className={`rounded-lg border p-3 text-left transition ${
									editorialIntent === intent.value
										? "border-[var(--brand)] bg-[var(--success-soft)] text-[var(--foreground)]"
										: "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
								}`}
							>
								<span className="block text-[12px] font-bold">{intent.label}</span>
								<span className="mt-1 block text-[11px] leading-4 text-[var(--muted)]">
									{intent.description}
								</span>
							</button>
						))}
					</div>
				</Field>
			</Section>

			<Section
				description="Chọn việc bạn muốn AI làm. Kết quả hiện ra để so sánh trước khi áp dụng."
				icon={Wand2}
				title="Thao tác"
			>
				<div className="space-y-4">
					{AI_ACTION_GROUPS.map((group) => {
						const actions = AI_ACTIONS.filter(
							(action) => action.group === group.id,
						);
						if (!actions.length) return null;
						return (
							<div key={group.id}>
								<p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
									{group.label}
								</p>
								<div className="mt-2 grid gap-2 sm:grid-cols-2">
									{actions.map((action) => (
										<AiActionCard
											action={action}
											busy={busy === `ai:${action.key}`}
											disabled={running || (action.requires === "body" && !hasBody)}
											key={action.key}
											onAsk={onAsk}
											unavailableReason={
												action.requires === "body" && !hasBody
													? "Cần có nội dung trong bài trước khi dùng thao tác này."
													: undefined
											}
										/>
									))}
								</div>
							</div>
						);
					})}
				</div>
			</Section>

			<Section
				description="Không bắt buộc. Điều chỉnh khi bài cần một sắc thái riêng."
				icon={Info}
				title="Tùy chỉnh cách viết"
			>
				<div className="grid gap-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<Field hint="Thái độ của bài viết." label="Giọng điệu">
							<PresetInput
								onChange={onToneChange}
								options={AI_TONE_PRESETS}
								value={tone}
							/>
						</Field>
						<Field hint="Cảm giác khi đọc câu chữ." label="Văn phong">
							<PresetInput
								onChange={onVoiceChange}
								options={AI_VOICE_PRESETS}
								value={voice}
							/>
						</Field>
					</div>
					<Field
						hint="Càng cụ thể, đề xuất càng sát ý bạn."
						label="Yêu cầu riêng cho AI"
					>
						<textarea
							value={instruction}
							onChange={(event) => onInstructionChange(event.target.value)}
							rows={3}
							className={textareaClass}
							placeholder="Ví dụ: Mở đầu gần gũi hơn, giữ nguyên mọi số liệu…"
						/>
						<span className="mt-2 flex flex-wrap gap-1.5">
							{AI_INSTRUCTION_HINTS.map((hint) => (
								<button
									key={hint}
									type="button"
									onClick={() =>
										onInstructionChange(
											instruction ? `${instruction.trim()} ${hint}` : hint,
										)
									}
									className="rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--muted-strong)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
								>
									+ {hint}
								</button>
							))}
						</span>
					</Field>
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
				</div>
			</Section>
		</div>
	);
}

function AiActionCard({
	action,
	busy,
	disabled,
	onAsk,
	unavailableReason,
}: {
	action: AiAction;
	busy: boolean;
	disabled: boolean;
	onAsk: (action: string) => void;
	unavailableReason?: string;
}) {
	const Icon = action.icon;
	const card = (
		<button
			type="button"
			disabled={disabled}
			onClick={() => onAsk(action.key)}
			className="flex w-full items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--brand)] hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-55"
		>
			<span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-strong)]">
				{busy ? (
					<LoaderCircle size={14} className="animate-spin" />
				) : (
					<Icon size={14} />
				)}
			</span>
			<span className="min-w-0">
				<span className="block text-[12px] font-bold text-[var(--foreground)]">
					{busy ? "Đang xử lý…" : action.label}
				</span>
				<span className="mt-0.5 block text-[11px] leading-4 text-[var(--muted)]">
					{action.description}
				</span>
			</span>
		</button>
	);

	if (!unavailableReason) return card;
	return <DashboardTooltip content={unavailableReason}>{card}</DashboardTooltip>;
}

function PresetInput({
	onChange,
	options,
	value,
}: {
	onChange: (value: string) => void;
	options: string[];
	value: string;
}) {
	return (
		<span className="block">
			<input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className={inputClass}
			/>
			<span className="mt-2 flex flex-wrap gap-1.5">
				{options.map((option) => (
					<button
						key={option}
						type="button"
						aria-pressed={value === option}
						onClick={() => onChange(option)}
						className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
							value === option
								? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
								: "bg-[var(--surface-soft)] text-[var(--muted-strong)] hover:text-[var(--foreground)]"
						}`}
					>
						{option}
					</button>
				))}
			</span>
		</span>
	);
}

export { AiProposalReview } from "./ai-proposal-review";
