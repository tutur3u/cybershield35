import {
	AlertTriangle,
	ArrowRight,
	Clock3,
	Database,
	FileBarChart,
	FileText,
	MessageSquareText,
	Plus,
	Radar,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import Link from "next/link";

import {
	AlertPanel,
	EvidencePanel,
	RiskFlagPanel,
	SentimentAndStance,
	TopicPanel,
} from "@/components/dashboard/analysis-widgets";
import {
	DraftReview,
	SourceDetail,
} from "@/components/dashboard/counter-argument-widgets";
import { SocialLogoGrid } from "@/components/dashboard/dialogs";
import type { ClientRuntimeSummary } from "@/components/dashboard/runtime-credentials";
import {
	AnalysisSummary,
	AuthSummary,
	DraftSnapshot,
	MetricGrid,
	PageHeader,
	ProviderStatus,
	QueueCard,
} from "@/components/dashboard/page-widgets";
import type {
	AuthViewState,
	DraftShape,
	EvidenceView,
	ProviderAvailabilityView,
	ScanDetail,
	TopicCluster,
} from "@/components/dashboard/types";
import { Panel, PanelHeader, SecondaryButton } from "@/components/dashboard/ui-primitives";
import { type DashboardScan, demoAnalysis } from "@/lib/domain/fixtures";

export type DashboardPageProps = {
	auth: AuthViewState;
	scans: DashboardScan[];
	selectedScan?: DashboardScan;
	selectedScanId: string;
	detail: ScanDetail | null;
	analysis: typeof demoAnalysis;
	topics: TopicCluster[];
	evidence: EvidenceView;
	draft: DraftShape;
	providerAvailability: ProviderAvailabilityView | null;
	clientRuntimeSummary: ClientRuntimeSummary;
	onSelectScan: (id: string) => void;
	onOpenAuth: () => void;
	onOpenScan: () => void;
	onOpenDraft: () => void;
	onOpenTestingKeys: () => void;
	onRefreshAuth: () => Promise<void>;
	onLogout: () => Promise<void>;
	onReview: (status: "needs_review" | "approved" | "rejected") => Promise<void>;
};

export function OverviewPage(props: DashboardPageProps) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={ShieldCheck}
				title="Tổng quan vận hành"
				description="Trạng thái xác thực, hàng đợi và tín hiệu phân tích mới nhất."
				actions={
					<>
						<SecondaryButton onClick={props.onOpenScan}>
							<Plus size={14} /> Tạo scan
						</SecondaryButton>
						<SecondaryButton onClick={props.onOpenDraft}>
							<Sparkles size={14} /> Tạo phản hồi
						</SecondaryButton>
					</>
				}
			/>
			<MetricGrid />
			<div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
				<AuthSummary
					auth={props.auth}
					onOpenAuth={props.onOpenAuth}
					onRefreshAuth={props.onRefreshAuth}
					onLogout={props.onLogout}
				/>
				<QueueCard
					scans={props.scans}
					selectedScanId={props.selectedScanId}
					onSelectScan={props.onSelectScan}
					limit={4}
				/>
				<AnalysisSummary analysis={props.analysis} />
				<DraftSnapshot
					draft={props.draft}
					onOpenDraft={props.onOpenDraft}
					scanId={props.selectedScanId}
				/>
			</div>
		</div>
	);
}

export function SourcesPage(props: DashboardPageProps) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Radar}
				title="Nguồn & Quét"
				description="Quản lý hàng đợi thu thập từ URL, mạng xã hội, tệp và văn bản."
				actions={
					<SecondaryButton onClick={props.onOpenScan}>
						<Plus size={14} /> Tạo scan mới
					</SecondaryButton>
				}
			/>
			<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
				<Panel>
					<PanelHeader
						title="Nguồn được hỗ trợ"
						description="Chỉ nhận Facebook công khai và liên kết website tùy chỉnh trong giai đoạn này."
					/>
					<div className="p-4">
						<SocialLogoGrid />
					</div>
				</Panel>
				<ProviderStatus
					availability={props.providerAvailability ?? undefined}
					clientSummary={props.clientRuntimeSummary}
					onOpenTestingKeys={props.onOpenTestingKeys}
				/>
				<div className="xl:col-span-2">
					<QueueCard
						scans={props.scans}
						selectedScanId={props.selectedScanId}
						onSelectScan={props.onSelectScan}
					/>
				</div>
			</div>
		</div>
	);
}

export function AnalysisPage(props: DashboardPageProps) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Database}
				title="Phân tích thảo luận"
				description="Chủ đề, lập trường, cảm xúc, rủi ro và bằng chứng chuẩn hóa."
				actions={
					<Link
						href="/evidence"
						className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
					>
						Kho bằng chứng <ArrowRight size={14} />
					</Link>
				}
			/>
			<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
				<AnalysisSummary analysis={props.analysis} />
				<SentimentAndStance />
				<TopicPanel topics={props.topics} />
				<AlertPanel />
				<div className="xl:col-span-2">
					<EvidencePanel evidence={props.evidence} limit={5} scanId={props.selectedScanId} />
				</div>
			</div>
		</div>
	);
}

export function CounterArgumentsPage(props: DashboardPageProps) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={MessageSquareText}
				title="Lập luận phản hồi"
				description="Soạn bản nháp có trích dẫn bằng chứng, chờ người vận hành duyệt."
				actions={
					<SecondaryButton onClick={props.onOpenDraft}>
						<Sparkles size={14} /> Tạo bản nháp
					</SecondaryButton>
				}
			/>
			<div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
				<SourceDetail
					selectedScan={props.selectedScan}
					detail={props.detail}
					analysis={props.analysis}
				/>
				<DraftReview
					draft={props.draft}
					onReview={props.onReview}
					scanId={props.selectedScanId}
				/>
				<div className="xl:col-span-2">
					<EvidencePanel evidence={props.evidence} limit={8} scanId={props.selectedScanId} />
				</div>
			</div>
		</div>
	);
}

export function EvidencePage(props: DashboardPageProps) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Database}
				title="Kho bằng chứng"
				description="Các trích dẫn đã chuẩn hóa dùng cho phân tích và phản hồi nội bộ."
			/>
			<EvidencePanel evidence={props.evidence} scanId={props.selectedScanId} />
		</div>
	);
}

export function AlertsPage(props: DashboardPageProps) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={AlertTriangle}
				title="Cảnh báo & Rủi ro"
				description="Tổng hợp cờ rủi ro và tín hiệu cần ưu tiên xử lý."
			/>
			<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
				<AlertPanel />
				<RiskFlagPanel analysis={props.analysis} />
			</div>
		</div>
	);
}

export function ReportsPage(props: DashboardPageProps) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={FileBarChart}
				title="Báo cáo"
				description="Các chế độ xuất báo cáo phục vụ trao đổi nội bộ và điều phối."
			/>
			<div className="grid gap-4 md:grid-cols-3">
				{[
					["Tóm tắt lãnh đạo", "Một trang về rủi ro, bằng chứng và khuyến nghị."],
					["Bộ bằng chứng", "Danh sách trích dẫn, nguồn và mức rủi ro."],
					["Nhật ký xử lý", "Dòng thời gian scan, provider và duyệt bản nháp."],
				].map(([title, description]) => (
					<Panel key={title}>
						<div className="p-4">
							<FileText className="text-[var(--accent)]" size={22} />
							<h2 className="mt-3 text-[14px] font-bold text-[var(--foreground)]">
								{title}
							</h2>
							<p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
								{description}
							</p>
							<div className="mt-4">
								<SecondaryButton>
									<FileBarChart size={14} /> Chuẩn bị báo cáo
								</SecondaryButton>
							</div>
						</div>
					</Panel>
				))}
			</div>
			<AnalysisSummary analysis={props.analysis} />
		</div>
	);
}

export function SettingsPage(props: DashboardPageProps) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={ShieldCheck}
				title="Cấu hình"
				description="Trạng thái provider, khóa kiểm thử và xác thực Tuturuuu."
				actions={
					<SecondaryButton onClick={props.onOpenAuth}>
						<ShieldCheck size={14} /> Quản lý phiên
					</SecondaryButton>
				}
			/>
			<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
				<ProviderStatus
					availability={props.providerAvailability ?? undefined}
					clientSummary={props.clientRuntimeSummary}
					onOpenTestingKeys={props.onOpenTestingKeys}
				/>
				<AuthSummary
					auth={props.auth}
					onOpenAuth={props.onOpenAuth}
					onRefreshAuth={props.onRefreshAuth}
					onLogout={props.onLogout}
				/>
			</div>
		</div>
	);
}

export function AuditPage(props: DashboardPageProps) {
	const events = props.detail?.audit?.length
		? props.detail.audit
		: [
				{ id: "audit-1", action: "source_registered", createdAt: props.selectedScan?.createdAt },
				{ id: "audit-2", action: "provider_selected", createdAt: props.selectedScan?.createdAt },
				{ id: "audit-3", action: "human_review_required", createdAt: props.draft.createdAt },
			];

	return (
		<div className="space-y-5">
			<PageHeader
				icon={Clock3}
				title="Nhật ký hoạt động"
				description="Theo dõi thao tác scan, provider, phân tích và trạng thái duyệt."
			/>
			<Panel>
				<div className="border-b border-[var(--border)] px-4 py-3">
					<h2 className="text-[15px] font-bold text-[var(--foreground)]">
						Dòng thời gian
					</h2>
				</div>
				<div className="divide-y divide-[var(--divider)] p-4">
					{events.map((event) => (
						<div
							key={event.id ?? `${event.action}-${event.createdAt}`}
							className="grid gap-2 py-3 sm:grid-cols-[180px_minmax(0,1fr)]"
						>
							<span className="text-[12px] font-semibold text-[var(--muted)]">
								{formatTime(event.createdAt)}
							</span>
							<div className="min-w-0">
								<p className="text-[13px] font-bold text-[var(--foreground)]">
									{event.action ?? "activity"}
								</p>
								<p className="mt-1 text-[12px] text-[var(--muted)]">
									Bản ghi phục vụ kiểm toán nội bộ và truy vết xử lý.
								</p>
							</div>
						</div>
					))}
				</div>
			</Panel>
		</div>
	);
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
