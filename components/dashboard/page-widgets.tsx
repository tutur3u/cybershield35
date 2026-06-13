import {
	LogOut,
	KeyRound,
	RefreshCw,
	ShieldCheck,
	Sparkles,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { providerRows, queueStats } from "@/components/dashboard/dashboard-data";
import type { ClientRuntimeSummary } from "@/components/dashboard/runtime-credentials";
import type {
	AuthViewState,
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
import type { DashboardScan } from "@/lib/domain/fixtures";
import { demoAnalysis } from "@/lib/domain/fixtures";

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
		<div className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-white px-4 py-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 items-start gap-3">
				<span className="grid size-11 shrink-0 place-items-center rounded-md bg-green-50 text-[var(--brand)]">
					<Icon size={22} />
				</span>
				<div className="min-w-0">
					<h1 className="text-[20px] font-bold text-slate-950">{title}</h1>
					<p className="mt-1 max-w-3xl text-[13px] leading-5 text-slate-500">
						{description}
					</p>
				</div>
			</div>
			{actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
		</div>
	);
}

export function MetricGrid() {
	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			{queueStats.map((stat) => (
				<Panel key={stat.label}>
					<div className="p-4">
						<p className={`text-[26px] font-bold ${statColor(stat.tone)}`}>
							{stat.value}
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
	onOpenAuth,
	onRefreshAuth,
}: {
	auth: AuthViewState;
	onLogout: () => Promise<void>;
	onOpenAuth: () => void;
	onRefreshAuth: () => Promise<void>;
}) {
	const authenticated = Boolean(auth.session);

	return (
		<Panel>
			<PanelHeader title="Tuturuuu external app login" />
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
								: auth.demoBypass
									? "Local demo auth bypass đang bật"
									: "Chưa có phiên riêng tư"}
						</p>
						<p className="mt-1 truncate text-[11px] opacity-80">
							{authenticated
								? `Workspace: ${auth.session?.workspaceId ?? "linked"}`
								: "Dùng nút quản lý phiên để dán short app token."}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<SecondaryButton onClick={onOpenAuth}>
						<ShieldCheck size={14} /> Quản lý phiên
					</SecondaryButton>
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
		<Panel>
			<PanelHeader
				title="Hàng đợi quét"
				description="Chọn một scan để xem phân tích, bằng chứng và bản nháp."
			/>
			<div className="divide-y divide-[var(--border)]">
				{visible.map((scan) => (
					<Link
						key={scan.id}
						href={`/scans/${scan.id}`}
						onClick={() => onSelectScan(scan.id)}
						className={`grid w-full gap-3 px-4 py-3 text-left transition sm:grid-cols-[minmax(0,1fr)_108px_92px] sm:items-center ${
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
				))}
			</div>
		</Panel>
	);
}

export function ProviderStatus({
	availability,
	clientSummary,
	onOpenTestingKeys,
}: {
	availability?: ProviderAvailabilityView;
	clientSummary?: ClientRuntimeSummary;
	onOpenTestingKeys?: () => void;
}) {
	return (
		<Panel>
			<PanelHeader
				title="Provider adapters"
				description="Server key được ưu tiên; browser-session key chỉ dùng khi server thiếu."
				action={
					onOpenTestingKeys ? (
						<SecondaryButton onClick={onOpenTestingKeys}>
							<KeyRound size={14} /> Khóa kiểm thử
						</SecondaryButton>
					) : null
				}
			/>
			<div className="space-y-3 p-4">
				{providerRows.map((provider) => (
					<div
						key={provider.label}
						className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
					>
						<div className="flex items-center justify-between gap-3">
							<p className="text-[13px] font-bold text-[var(--foreground)]">
								{provider.label}
							</p>
							<span
								className={`rounded-full px-2 py-1 text-[10px] font-bold ${providerStatusStyle(
									providerStatus(provider.key, availability, clientSummary),
								)}`}
							>
								{providerStatusLabel(
									providerStatus(provider.key, availability, clientSummary),
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

export function AnalysisSummary({ analysis }: { analysis: typeof demoAnalysis }) {
	return (
		<Panel>
			<PanelHeader title="Tóm tắt phân tích" />
			<div className="space-y-4 p-4">
				<p className="text-[13px] leading-6 text-[var(--muted-strong)]">
					{analysis.summary}
				</p>
				<div className="flex flex-wrap gap-2">
					<RiskPill risk={analysis.riskLevel} />
					<span className="inline-flex h-6 items-center rounded-full bg-[var(--accent-soft)] px-2 text-[11px] font-bold text-[var(--accent-strong)]">
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
	draft: DraftShape;
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
			</div>
		</Panel>
	);
}

function statColor(tone: string) {
	if (tone === "success") return "text-[var(--brand)]";
	if (tone === "danger") return "text-[var(--danger-strong)]";
	if (tone === "warning") return "text-[var(--warning-strong)]";
	return "text-[var(--foreground)]";
}

type ProviderStatusState = "server" | "browser_session" | "demo";

function providerStatus(
	key: string,
	availability?: ProviderAvailabilityView,
	clientSummary?: ClientRuntimeSummary,
): ProviderStatusState {
	if (key === "googleGenerativeAi") {
		if (availability?.llm) return "server";
		if (clientSummary?.googleGenerativeAi) return "browser_session";
		return "demo";
	}

	if (key === "apify") {
		if (availability?.apify) return "server";
		if (clientSummary?.apify) return "browser_session";
		return "demo";
	}

	if (key === "firecrawl") {
		if (availability?.firecrawl) return "server";
		if (clientSummary?.firecrawl) return "browser_session";
		return "demo";
	}

	if (key === "browserUse") {
		if (availability?.browserUse) return "server";
		if (clientSummary?.browserUse) return "browser_session";
		return "demo";
	}

	return "demo";
}

function providerStatusLabel(status: ProviderStatusState) {
	if (status === "server") return "Server";
	if (status === "browser_session") return "Browser";
	return "Demo";
}

function providerStatusStyle(status: ProviderStatusState) {
	if (status === "server") {
		return "bg-[var(--success-soft)] text-[var(--success-strong)]";
	}
	if (status === "browser_session") {
		return "bg-[var(--accent-soft)] text-[var(--accent-strong)]";
	}
	return "bg-[var(--neutral-soft)] text-[var(--muted-strong)]";
}

function providerLabel(provider: string) {
	if (provider.startsWith("apify")) return "Apify";
	if (provider.startsWith("firecrawl")) return "Firecrawl";
	if (provider === "browser_use") return "Browser Use";
	if (provider === "local_text") return "Local Text";
	return "Demo";
}

function draftStatusLabel(status?: string) {
	if (status === "approved") return "Approved";
	if (status === "rejected") return "Rejected";
	return "Human review";
}
