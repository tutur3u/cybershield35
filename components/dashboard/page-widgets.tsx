import {
	LogOut,
	RefreshCw,
	ShieldCheck,
	Sparkles,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { providerRows } from "@/components/dashboard/dashboard-data";
import type {
	AnalysisView,
	AuthViewState,
	DashboardScan,
	DraftShape,
	ProviderAvailabilityView,
} from "@/components/dashboard/types";
import {
	Panel,
	PanelHeader,
	ProgressBar,
	RiskPill,
	SecondaryButton,
	StatusPill,
} from "@/components/dashboard/ui-primitives";

export function PageHeader({
	actions,
	description,
	icon: Icon,
	title,
}: {
	actions?: ReactNode;
	description: string;
	icon: LucideIcon;
	title: string;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 items-start gap-3">
				<span className="grid size-11 shrink-0 place-items-center rounded-md bg-[var(--success-soft)] text-[var(--brand)]">
					<Icon size={22} />
				</span>
				<div className="min-w-0">
					<h1 className="text-[20px] font-bold leading-7 text-[var(--foreground)]">
						{title}
					</h1>
					<p className="mt-1 max-w-3xl text-[13px] leading-5 text-[var(--muted)]">
						{description}
					</p>
				</div>
			</div>
			{actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
		</div>
	);
}

export function MetricGrid({ scans }: { scans: DashboardScan[] }) {
	const stats = [
		{ label: "Đang chờ", value: countScans(scans, "queued"), tone: "neutral" },
		{ label: "Đang quét", value: countScans(scans, "running"), tone: "warning" },
		{ label: "Hoàn tất", value: countScans(scans, "completed"), tone: "success" },
		{ label: "Lỗi", value: countScans(scans, "failed"), tone: "danger" },
	];

	return (
		<div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
			{stats.map((stat) => (
				<Panel key={stat.label} className="h-full">
					<div className="p-4">
						<p className={`text-[26px] font-bold ${statColor(stat.tone)}`}>
							{stat.value.toLocaleString("vi-VN")}
						</p>
						<p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">
							{stat.label}
						</p>
					</div>
				</Panel>
			))}
		</div>
	);
}

export function AuthSummary({
	auth,
	onLogout,
	onRefreshAuth,
}: {
	auth: AuthViewState;
	onLogout: () => Promise<void>;
	onRefreshAuth: () => Promise<void>;
}) {
	const authenticated = Boolean(auth.session);

	return (
		<Panel>
			<PanelHeader title="Tuturuuu server auth" />
			<div className="space-y-4 p-4">
				<div
					className={`flex items-center gap-3 rounded-lg p-3 ${
					authenticated
						? "bg-[var(--success-soft)] text-[var(--success-strong)]"
						: "bg-[var(--warning-soft)] text-[var(--warning-strong)]"
					}`}
				>
					<ShieldCheck size={20} />
					<div className="min-w-0">
						<p className="truncate text-[13px] font-bold">
							{authenticated
								? (auth.session?.user.email ?? auth.session?.user.id)
								: "Chưa có phiên riêng tư"}
						</p>
						<p className="mt-1 truncate text-[11px] opacity-80">
							{authenticated
								? `Workspace: ${auth.session?.workspaceId ?? "linked"}`
								: "Kiểm tra cấu hình server-side và mở lại sau khi redeploy."}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					{authenticated ? (
						<>
							<SecondaryButton onClick={onRefreshAuth}>
								<RefreshCw size={14} /> Refresh
							</SecondaryButton>
							<SecondaryButton onClick={onLogout}>
								<LogOut size={14} /> Logout
							</SecondaryButton>
						</>
					) : null}
				</div>
			</div>
		</Panel>
	);
}

export function QueueCard({
	limit,
	onSelectScan,
	scans,
	selectedScanId,
}: {
	limit?: number;
	onSelectScan: (id: string) => void;
	scans: DashboardScan[];
	selectedScanId: string;
}) {
	const visible = limit ? scans.slice(0, limit) : scans;

	return (
		<Panel className="h-full">
			<PanelHeader
				title="Hàng đợi quét"
				description="Chọn một scan để xem phân tích, bằng chứng và bản nháp."
			/>
			<div className="divide-y divide-[var(--divider)]">
				{visible.length ? (
					visible.map((scan) => (
						<Link
							key={scan.id}
							href={`/scans/${scan.id}`}
							onClick={() => onSelectScan(scan.id)}
							className={`grid min-h-16 w-full gap-3 px-4 py-3 text-left transition sm:grid-cols-[minmax(0,1fr)_96px_96px] sm:items-center ${
								selectedScanId === scan.id
									? "bg-[var(--accent-soft)]"
									: "hover:bg-[var(--surface-soft)]"
							}`}
						>
							<div className="min-w-0">
								<p className="truncate text-[13px] font-bold text-[var(--foreground)]">
									{scan.title}
								</p>
								<p className="mt-1 truncate text-[11px] text-[var(--muted)]">
									{scan.sourceLabel} - {providerLabel(scan.provider)}
								</p>
							</div>
							<StatusPill status={scan.status} />
							<div className="min-w-0 text-[11px] font-semibold text-[var(--muted)] sm:text-right">
								{scan.progress}%
								<div className="mt-1">
									<ProgressBar value={scan.progress} />
								</div>
							</div>
						</Link>
					))
				) : (
					<p className="px-4 py-5 text-[12px] font-semibold text-[var(--muted)]">
						Chưa có scan live. Tạo scan mới để bắt đầu thu thập.
					</p>
				)}
			</div>
		</Panel>
	);
}

export function ProviderStatus({
	availability,
}: {
	availability?: ProviderAvailabilityView;
}) {
	return (
		<Panel>
			<PanelHeader
				title="Provider adapters"
				description="Tất cả provider key phải được cấu hình bằng biến môi trường server-side."
			/>
			<div className="space-y-3 p-4">
				{providerRows.map((provider) => (
					<div
						key={provider.label}
						className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
					>
						<div className="flex items-center justify-between gap-3">
							<p className="min-w-0 truncate text-[13px] font-bold text-[var(--foreground)]">
								{provider.label}
							</p>
							<span
								className={`inline-flex h-6 min-w-12 shrink-0 items-center justify-center rounded-md px-2 text-center text-[10px] font-bold leading-none ${providerStatusStyle(
									providerStatus(provider.key, availability),
								)}`}
							>
								{providerStatusLabel(
									providerStatus(provider.key, availability),
								)}
							</span>
						</div>
						<p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
							{provider.helper}
						</p>
					</div>
				))}
			</div>
		</Panel>
	);
}

export function AnalysisSummary({
	analysis,
	className = "",
}: {
	analysis: AnalysisView;
	className?: string;
}) {
	return (
		<Panel className={className}>
			<PanelHeader title="Tóm tắt phân tích" />
			<div className="space-y-4 p-4">
				<p className="text-[13px] leading-6 text-[var(--muted-strong)]">
					{analysis.summary}
				</p>
				<div className="flex flex-wrap gap-2">
					<RiskPill risk={analysis.riskLevel} />
					<span className="inline-flex h-6 min-w-12 items-center justify-center rounded-md bg-[var(--accent-soft)] px-2.5 text-center text-[11px] font-bold leading-none text-[var(--accent-strong)]">
						{analysis.stanceSummary}
					</span>
				</div>
			</div>
		</Panel>
	);
}

export function DraftSnapshot({
	draft,
	onOpenDraft,
	scanId,
}: {
	draft: DraftShape | null;
	onOpenDraft: () => void;
	scanId?: string;
}) {
	return (
		<Panel>
			<PanelHeader
				title="Bản nháp phản hồi"
				action={
					<SecondaryButton onClick={onOpenDraft}>
						<Sparkles size={14} /> Tạo mới
					</SecondaryButton>
				}
			/>
			<div className="p-4">
				{draft ? (
					<>
						<p className="rounded-lg bg-[var(--surface-soft)] p-3 text-[13px] leading-6 text-[var(--muted-strong)]">
							{draft.body}
						</p>
						<p className="mt-3 text-[11px] font-semibold text-[var(--muted)]">
							Trạng thái: {draftStatusLabel(draft.status)}
						</p>
						<Link
							href={`/drafts/${draft.id}${scanId ? `?scanId=${scanId}` : ""}`}
							className="mt-3 inline-flex h-9 items-center rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)]"
						>
							Xem chi tiết
						</Link>
					</>
				) : (
					<p className="rounded-lg bg-[var(--surface-soft)] p-3 text-[13px] leading-6 text-[var(--muted-strong)]">
						Chưa có bản nháp live cho scan đang chọn.
					</p>
				)}
			</div>
		</Panel>
	);
}

function countScans(scans: DashboardScan[], status: DashboardScan["status"]) {
	return scans.filter((scan) => scan.status === status).length;
}

function statColor(tone: string) {
	if (tone === "success") return "text-[var(--brand)]";
	if (tone === "danger") return "text-[var(--danger-strong)]";
	if (tone === "warning") return "text-[var(--warning-strong)]";
	return "text-[var(--foreground)]";
}

type ProviderStatusState = "server" | "missing";

function providerStatus(
	key: string,
	availability?: ProviderAvailabilityView,
): ProviderStatusState {
	if (key === "googleGenerativeAi") {
		if (availability?.llm) return "server";
		return "missing";
	}

	if (key === "apify") {
		if (availability?.apify) return "server";
		return "missing";
	}

	if (key === "firecrawl") {
		if (availability?.firecrawl) return "server";
		return "missing";
	}

	if (key === "browserUse") {
		if (availability?.browserUse) return "server";
		return "missing";
	}

	return "missing";
}

function providerStatusLabel(status: ProviderStatusState) {
	if (status === "server") return "Server";
	return "Missing";
}

function providerStatusStyle(status: ProviderStatusState) {
	if (status === "server") {
		return "bg-[var(--success-soft)] text-[var(--success-strong)]";
	}
	return "bg-[var(--neutral-soft)] text-[var(--muted-strong)]";
}

function providerLabel(provider: string) {
	if (provider.startsWith("apify")) return "Apify";
	if (provider.startsWith("firecrawl")) return "Firecrawl";
	if (provider === "browser_use") return "Browser Use";
	if (provider === "local_text") return "Local Text";
	return provider;
}

function draftStatusLabel(status?: string) {
	if (status === "approved") return "Approved";
	if (status === "rejected") return "Rejected";
	return "Human review";
}
