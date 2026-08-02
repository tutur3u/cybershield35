"use client";

import {
	ArrowUpRight,
	BrainCircuit,
	Layers3,
	RefreshCw,
	Sparkles,
} from "lucide-react";
import { useState } from "react";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import type {
	EvidenceSemanticRebuildResult,
	RelatedEvidenceItem,
} from "@/components/dashboard/types";
import { Panel, PanelHeader } from "@/components/dashboard/ui-primitives";

export function RelatedEvidencePanel({
	error,
	generatedAt,
	items,
	model,
	onRebuild,
	onRetry,
	pending,
	profileReady,
	rebuildError,
	rebuildPending,
	rebuildResult,
}: {
	error: Error | null;
	generatedAt: string | null;
	items: RelatedEvidenceItem[];
	model: string | null;
	onRebuild: () => void;
	onRetry: () => void;
	pending: boolean;
	profileReady: boolean;
	rebuildError: Error | null;
	rebuildPending: boolean;
	rebuildResult?: EvidenceSemanticRebuildResult;
}) {
	const [confirming, setConfirming] = useState(false);
	return (
		<Panel>
			<PanelHeader
				title={`Bằng chứng liên quan${items.length ? ` (${items.length})` : ""}`}
				description="Xếp hạng theo sự kiện, hành vi và chi tiết cụ thể trên toàn bộ kho; kết quả yếu hoặc trùng lặp được ẩn."
				action={
					confirming ? (
						<RebuildConfirmation
							onCancel={() => setConfirming(false)}
							onConfirm={() => {
								setConfirming(false);
								onRebuild();
							}}
						/>
					) : (
						<button
							type="button"
							disabled={rebuildPending}
							onClick={() => setConfirming(true)}
							className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[11px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] disabled:cursor-wait disabled:opacity-60"
						>
							<RefreshCw
								className={rebuildPending ? "animate-spin" : ""}
								size={13}
							/>
							{rebuildPending ? "Đang cập nhật…" : "Cập nhật chỉ mục"}
						</button>
					)
				}
			/>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--divider)] bg-[var(--surface-soft)] px-4 py-3 text-[11px] leading-5 text-[var(--muted)]">
				<span className="inline-flex items-center gap-1.5 font-bold text-[var(--muted-strong)]">
					<BrainCircuit size={13} /> {semanticEngineLabel(model)}
				</span>
				<span className="inline-flex items-center gap-1.5">
					<Layers3 size={13} /> Vector + hành vi + chi tiết + thời gian
				</span>
				<span className="ml-auto">
					{generatedAt
						? `Cập nhật ${formatPublished(generatedAt)}`
						: "Chưa có hồ sơ ngữ nghĩa"}
				</span>
				{model ? <span className="sr-only">Mô hình {model}</span> : null}
			</div>
			<RebuildStatus error={rebuildError} result={rebuildResult} />
			<div className="p-3 sm:p-4">
				{pending ? (
					<div className="grid min-h-40 place-items-center" role="status">
						<p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
							<Sparkles className="animate-pulse" size={16} /> Đang đối chiếu sự kiện…
						</p>
					</div>
				) : error ? (
					<ErrorState onRetry={onRetry} />
				) : items.length ? (
					<div className="grid gap-3 lg:grid-cols-2">
						{items.map((item) => (
							<RelatedEvidenceCard item={item} key={item.id} />
						))}
					</div>
				) : (
					<EmptyState profileReady={profileReady} />
				)}
			</div>
		</Panel>
	);
}

function RelatedEvidenceCard({ item }: { item: RelatedEvidenceItem }) {
	return (
		<IntentPrefetchLink
			href={`/evidence/${item.id}`}
			className="group relative flex min-h-56 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md"
		>
			<div
				aria-hidden="true"
				className={`absolute inset-y-0 left-0 w-1 ${relationshipRail(item.relationship)}`}
			/>
			<div className="flex items-start justify-between gap-3 pl-1">
				<span className={`rounded-md px-2 py-1 text-[10px] font-extrabold ${relationshipBadge(item.relationship)}`}>
					{relationshipLabel(item.relationship)}
				</span>
				<div className="flex items-center gap-2">
					<span className="text-[11px] font-extrabold tabular-nums text-[var(--foreground)]">
						{Math.round(item.relevance * 100)}% phù hợp
					</span>
					<ArrowUpRight className="text-[var(--muted)] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)]" size={15} />
				</div>
			</div>
			<div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--surface-soft)]" aria-hidden="true">
				<div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.round(item.relevance * 100)}%` }} />
			</div>
			<p className="mt-4 line-clamp-3 text-[13px] font-semibold leading-6 text-[var(--foreground)]">
				{item.quote}
			</p>
			<div className="mt-auto pt-4">
				{item.reasons.length ? (
					<div>
						<p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">
							Vì sao liên quan
						</p>
						<div className="mt-2 flex flex-wrap gap-1.5">
							{item.reasons.map((reason) => (
								<span key={reason} className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-bold text-[var(--accent-strong)]">
									{reason}
								</span>
							))}
						</div>
					</div>
				) : null}
				<div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--divider)] pt-3 text-[10px] text-[var(--muted)]">
					<span className="truncate">{item.sourceLabel ?? item.author ?? "Nguồn công khai"} · {formatPublished(item.publishedAt ?? item.createdAt)}</span>
					<span className="font-semibold tabular-nums">Vector {Math.round(item.semanticSimilarity * 100)}%</span>
				</div>
			</div>
		</IntentPrefetchLink>
	);
}

function RebuildConfirmation({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
	return <div className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label="Xác nhận cập nhật chỉ mục"><span className="text-[11px] font-semibold text-[var(--muted)]">Tạo lại toàn bộ vector?</span><button type="button" onClick={onCancel} className="inline-flex min-h-9 items-center rounded-md border border-[var(--border)] px-3 text-[11px] font-bold text-[var(--muted-strong)]">Hủy</button><button type="button" onClick={onConfirm} className="inline-flex min-h-9 items-center rounded-md bg-[var(--accent)] px-3 text-[11px] font-extrabold text-white">Cập nhật</button></div>;
}

function RebuildStatus({ error, result }: { error: Error | null; result?: EvidenceSemanticRebuildResult }) {
	if (error) return <p className="border-b border-[var(--divider)] bg-[var(--danger-soft)] px-4 py-2 text-xs font-semibold text-[var(--danger-strong)]" role="alert">{error.message}</p>;
	if (!result) return null;
	return <p className="border-b border-[var(--divider)] bg-[var(--success-soft)] px-4 py-2 text-xs font-semibold text-[var(--success-strong)]" role="status">Đã cập nhật {result.generated.toLocaleString("vi-VN")}/{result.total.toLocaleString("vi-VN")} bằng chứng{result.failed ? ` · ${result.failed} lỗi` : ""}.</p>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
	return <div className="py-10 text-center"><p className="text-sm font-bold text-[var(--danger-strong)]">Không thể tải bằng chứng liên quan.</p><button type="button" onClick={onRetry} className="mt-3 text-xs font-bold text-[var(--accent-strong)]">Thử lại</button></div>;
}

function EmptyState({ profileReady }: { profileReady: boolean }) {
	return <div className="py-10 text-center"><p className="text-sm font-bold text-[var(--foreground)]">{profileReady ? "Không có bằng chứng đủ liên quan" : "Cần cập nhật chỉ mục bằng chứng"}</p><p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-[var(--muted)]">{profileReady ? "Không có kết quả nào vượt qua kiểm tra sự kiện và ngưỡng phù hợp. Nội dung gần giống nhưng khác hành vi đã được ẩn." : "Cập nhật chỉ mục để tạo liên kết theo sự kiện cho mọi bằng chứng hiện có."}</p></div>;
}

function relationshipLabel(relationship: RelatedEvidenceItem["relationship"]) {
	return relationship === "same_event" ? "Cùng sự kiện" : relationship === "strongly_related" ? "Liên quan chặt chẽ" : "Có liên quan";
}

function relationshipBadge(relationship: RelatedEvidenceItem["relationship"]) {
	return relationship === "same_event" ? "bg-[var(--accent)] text-white" : relationship === "strongly_related" ? "bg-[var(--success-soft)] text-[var(--success-strong)]" : "bg-[var(--accent-soft)] text-[var(--accent-strong)]";
}

function relationshipRail(relationship: RelatedEvidenceItem["relationship"]) {
	return relationship === "same_event" ? "bg-[var(--accent)]" : relationship === "strongly_related" ? "bg-[var(--success-strong)]" : "bg-[var(--border-strong)]";
}

function semanticEngineLabel(model: string | null) {
	if (model === "google/gemini-embedding-2") return "Tuturuuu · Gemini Embedding 2";
	if (model?.startsWith("local/")) return "So khớp ngữ nghĩa nội bộ";
	return "Xếp hạng ngữ nghĩa riêng tư";
}

function formatPublished(value: string) {
	return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}
