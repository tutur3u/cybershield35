import {
	AlertTriangle,
	CheckCircle2,
	ExternalLink,
	FileText,
	Globe2,
} from "lucide-react";
import Link from "next/link";

import type { DraftShape, ScanDetail } from "@/components/dashboard/types";
import {
	Panel,
	PanelHeader,
	RiskPill,
	SecondaryButton,
	StatusPill,
} from "@/components/dashboard/ui-primitives";
import { type DashboardScan, demoAnalysis } from "@/lib/domain/fixtures";

export function SourceDetail({
	analysis,
	detail,
	selectedScan,
}: {
	analysis: typeof demoAnalysis;
	detail: ScanDetail | null;
	selectedScan?: DashboardScan;
}) {
	return (
		<Panel>
			<PanelHeader
				title="Thông tin nguồn"
				action={<StatusPill status={selectedScan?.status ?? "running"} />}
			/>
			<div className="space-y-4 p-4">
				<div className="grid gap-3 text-[13px] sm:grid-cols-[112px_minmax(0,1fr)]">
					<span className="font-semibold text-slate-500">Nguồn</span>
					<span className="truncate text-slate-800">
						{selectedScan?.sourceLabel ?? detail?.source?.type ?? "Facebook"}
					</span>
					<span className="font-semibold text-slate-500">Tiêu đề</span>
					<span className="truncate text-slate-800">
						{selectedScan?.title ?? detail?.source?.title ?? "Nguồn chưa đặt tên"}
					</span>
					<span className="font-semibold text-slate-500">Thời gian</span>
					<span className="text-slate-800">{formatTime(selectedScan?.createdAt)}</span>
					<span className="font-semibold text-slate-500">URL</span>
					<span className="truncate text-slate-800">
						{detail?.source?.normalizedUrl ?? "https://facebook.com/example/posts/1"}
					</span>
				</div>
				<a
					href={detail?.source?.normalizedUrl ?? "#"}
					target="_blank"
					rel="noreferrer"
					className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-slate-700"
				>
					Xem nguồn gốc <ExternalLink size={14} />
				</a>
				<p className="rounded-lg bg-slate-50 p-3 text-[13px] leading-6 text-slate-700">
					{analysis.summary}
				</p>
				<RiskPill risk={analysis.riskLevel} />
			</div>
		</Panel>
	);
}

export function DraftReview({
	draft,
	onReview,
	scanId,
}: {
	draft: DraftShape;
	onReview: (status: "needs_review" | "approved" | "rejected") => Promise<void>;
	scanId?: string;
}) {
	return (
		<Panel>
			<PanelHeader
				title="Bản nháp đang duyệt"
				action={
					<span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
						{draftStatusLabel(draft.status)}
					</span>
				}
			/>
			<div className="space-y-4 p-4">
				<p className="rounded-lg bg-slate-50 p-3 text-[13px] leading-6 text-slate-700">
					{draft.body}
				</p>
				<div className="flex flex-wrap gap-2">
					<Link
						href={`/drafts/${draft.id}${scanId ? `?scanId=${scanId}` : ""}`}
						className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-[12px] font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
					>
						<FileText size={14} /> Chi tiết
					</Link>
					<SecondaryButton onClick={() => onReview("needs_review")}>
						<FileText size={14} /> Cần duyệt
					</SecondaryButton>
					<SecondaryButton onClick={() => onReview("rejected")}>
						<AlertTriangle size={14} /> Từ chối
					</SecondaryButton>
					<button
						type="button"
						onClick={() => onReview("approved")}
						className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--brand)] px-3 text-[12px] font-bold text-white transition hover:bg-[var(--brand-strong)]"
					>
						<CheckCircle2 size={14} /> Phê duyệt
					</button>
				</div>
				<p className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
					<Globe2 size={13} />
					Không tự động đăng tải hoặc nhắm mục tiêu nhân khẩu học.
				</p>
			</div>
		</Panel>
	);
}

function draftStatusLabel(status?: string) {
	if (status === "approved") return "Approved";
	if (status === "rejected") return "Rejected";
	return "Human review";
}

function formatTime(value?: string | Date) {
	if (!value) return "10:12 AM";
	return new Intl.DateTimeFormat("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(new Date(value));
}
