import {
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	Clock3,
	Database,
	FileBarChart,
	FileText,
	MessageSquareText,
	Plus,
	Radar,
	ScrollText,
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
import { reportSpecs } from "@/components/dashboard/dashboard-data";
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
	ChatMessage,
	DraftShape,
	EvidenceView,
	ProviderAvailabilityView,
	ReportSpec,
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
	chatMessages: ChatMessage[];
	isChatting: boolean;
	onSelectScan: (id: string) => void;
	onOpenAuth: () => void;
	onOpenScan: () => void;
	onOpenDraft: () => void;
	onOpenChatComposer: (preset?: string) => void;
	onOpenTestingKeys: () => void;
	onPrepareReport: (report: ReportSpec) => void;
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
				<div className="space-y-5">
					<Panel>
						<PanelHeader
							title="Nguồn được hỗ trợ"
							description="Chỉ nhận Facebook công khai và liên kết website tùy chỉnh trong giai đoạn này."
						/>
						<div className="p-4">
							<SocialLogoGrid />
						</div>
					</Panel>
					<QueueCard
						scans={props.scans}
						selectedScanId={props.selectedScanId}
						onSelectScan={props.onSelectScan}
					/>
				</div>
				<ProviderStatus
					availability={props.providerAvailability ?? undefined}
					clientSummary={props.clientRuntimeSummary}
					onOpenTestingKeys={props.onOpenTestingKeys}
				/>
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
			<div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
				<div className="space-y-5">
					<AnalysisSummary analysis={props.analysis} />
					<TopicPanel topics={props.topics} />
					<RiskFlagPanel analysis={props.analysis} />
				</div>
				<div className="grid gap-5 xl:grid-rows-[auto_minmax(0,1fr)]">
					<SentimentAndStance className="h-full" />
					<AlertPanel className="h-full" />
				</div>
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
		<div className="flex min-h-[calc(100vh-7rem)] flex-col gap-5">
			<PageHeader
				icon={FileBarChart}
				title="Báo cáo"
				description="Các chế độ xuất báo cáo phục vụ trao đổi nội bộ và điều phối."
			/>
			<div className="grid items-stretch gap-4 md:grid-cols-3">
				{reportSpecs.map((report) => (
					<Panel key={report.kind} className="h-full">
						<div className="flex h-full flex-col p-4">
							<FileText className="text-[var(--accent)]" size={22} />
							<h2 className="mt-3 text-[14px] font-bold text-[var(--foreground)]">
								{report.title}
							</h2>
							<p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
								{report.description}
							</p>
							<ul className="mt-3 flex-1 space-y-2 text-[11px] font-semibold text-[var(--muted-strong)]">
								{report.sections.map((section) => (
									<li key={section} className="flex gap-2">
										<span className="mt-1 size-1.5 shrink-0 rounded-sm bg-[var(--accent)]" />
										<span className="min-w-0">{section}</span>
									</li>
								))}
							</ul>
							<div className="mt-4">
								<SecondaryButton onClick={() => props.onPrepareReport(report)}>
									<FileBarChart size={14} /> Chuẩn bị báo cáo
								</SecondaryButton>
							</div>
						</div>
					</Panel>
				))}
			</div>
			<div className="grid min-w-0 flex-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
				<AnalysisSummary analysis={props.analysis} className="h-full" />
				<Panel className="h-full">
					<PanelHeader
						title="Dữ liệu xuất"
						description="Nội dung báo cáo lấy từ scan đang chọn, bằng chứng và bản nháp đã duyệt."
					/>
					<div className="grid min-w-0 content-start gap-3 p-4">
						<ReportReadiness
							label="Scan đang chọn"
							value={props.selectedScan?.title ?? "Demo scan"}
						/>
						<ReportReadiness label="Bằng chứng" value={`${props.evidence.length} mục`} />
						<ReportReadiness
							label="Bản nháp"
							value={reportDraftStatus(props.draft.status)}
						/>
						<ReportReadiness label="Rủi ro" value={reportRiskLabel(props.analysis.riskLevel)} />
					</div>
				</Panel>
			</div>
		</div>
	);
}

function ReportReadiness({ label, value }: { label: string; value: string }) {
	return (
		<div className="grid min-h-12 min-w-0 gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 sm:grid-cols-[minmax(86px,0.8fr)_minmax(0,1.2fr)] sm:items-center sm:gap-3">
			<span className="min-w-0 truncate text-[12px] font-semibold text-[var(--muted)]">
				{label}
			</span>
			<span className="min-w-0 break-words text-left text-[12px] font-bold leading-5 text-[var(--foreground)] sm:text-right">
				{value}
			</span>
		</div>
	);
}

function reportDraftStatus(status?: string) {
	if (status === "approved") return "Đã duyệt";
	if (status === "rejected") return "Từ chối";
	return "Cần duyệt";
}

function reportRiskLabel(risk?: string) {
	if (risk === "high") return "Cao";
	if (risk === "low") return "Thấp";
	return "Trung bình";
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

export function GuidePage({ kind }: { kind: "process" | "user" | "policies" }) {
	const content = guideContent[kind];

	return (
		<div className="space-y-5">
			<PageHeader
				icon={content.icon}
				title={content.title}
				description={content.description}
				actions={
					<Link
						href={content.primaryHref}
						className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
					>
						{content.primaryAction} <ArrowRight size={14} />
					</Link>
				}
			/>
			<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
				<Panel>
					<PanelHeader title={content.panelTitle} description={content.panelDescription} />
					<div className="divide-y divide-[var(--divider)] p-4">
						{content.steps.map((step, index) => (
							<div
								key={step.title}
								className="grid gap-3 py-4 sm:grid-cols-[42px_minmax(0,1fr)]"
							>
								<span className="grid size-8 place-items-center rounded-md bg-[var(--accent-soft)] text-[12px] font-bold text-[var(--accent-strong)]">
									{index + 1}
								</span>
								<div className="min-w-0">
									<h2 className="text-[14px] font-bold text-[var(--foreground)]">
										{step.title}
									</h2>
									<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
										{step.body}
									</p>
								</div>
							</div>
						))}
					</div>
				</Panel>
				<Panel>
					<PanelHeader title="Ghi nhớ vận hành" />
					<div className="space-y-3 p-4">
						{content.notes.map((note) => (
							<div
								key={note}
								className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
							>
								<CheckCircle2
									className="mt-0.5 shrink-0 text-[var(--brand)]"
									size={16}
								/>
								<p className="text-[12px] leading-5 text-[var(--muted-strong)]">
									{note}
								</p>
							</div>
						))}
					</div>
				</Panel>
			</div>
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

const guideContent = {
	process: {
		icon: Radar,
		title: "Quy trình 5 bước",
		description: "Luồng chuẩn để tiếp nhận nguồn, phân tích bằng chứng và soạn phản hồi có kiểm duyệt.",
		panelTitle: "Chuỗi xử lý khuyến nghị",
		panelDescription: "Áp dụng cho Facebook công khai, website, tệp và văn bản nhập tay.",
		primaryAction: "Tạo scan mới",
		primaryHref: "/sources",
		steps: [
			{
				title: "Tiếp nhận nguồn",
				body: "Chọn nguồn Facebook hoặc website tùy chỉnh, tải tệp, hoặc dán văn bản trong hộp thoại tạo scan.",
			},
			{
				title: "Tự động chọn adapter",
				body: "Hệ thống ưu tiên khóa server, dùng khóa kiểm thử trong phiên trình duyệt khi server chưa cấu hình, rồi mới dùng dữ liệu mẫu.",
			},
			{
				title: "Chuẩn hóa bằng chứng",
				body: "Các trích dẫn, nguồn, tác giả công khai và tín hiệu tương tác được lưu để phục vụ phân tích có thể truy vết.",
			},
			{
				title: "Phân tích LLM có cấu trúc",
				body: "Topic, lập trường, cảm xúc và cờ rủi ro được ràng buộc theo schema để người vận hành rà soát nhất quán.",
			},
			{
				title: "Soạn phản hồi cần duyệt",
				body: "Bản nháp lập luận chỉ dùng bằng chứng đã lưu, không tự động đăng tải và phải được duyệt thủ công.",
			},
		],
		notes: [
			"Không nhập khóa bí mật vào Postgres, audit log, metadata nguồn hoặc provider run.",
			"Luôn kiểm tra bằng chứng trước khi phê duyệt bản nháp phản hồi.",
			"Khi dữ liệu live chưa đủ, dùng chế độ demo để kiểm tra luồng thao tác thay vì suy diễn kết quả.",
		],
	},
	user: {
		icon: FileText,
		title: "Hướng dẫn sử dụng",
		description: "Các thao tác chính cho người vận hành dashboard CyberShield 35.",
		panelTitle: "Thao tác thường dùng",
		panelDescription: "Giữ các form trong hộp thoại và sử dụng từng trang cho một nhiệm vụ rõ ràng.",
		primaryAction: "Mở cấu hình",
		primaryHref: "/settings",
		steps: [
			{
				title: "Đăng nhập Tuturuuu",
				body: "Mở Cấu hình hoặc Tổng quan, chọn quản lý phiên và dán short app token do external app cấp.",
			},
			{
				title: "Thêm khóa kiểm thử",
				body: "Trong Cấu hình, mở Khóa để lưu Google AI, Apify, Firecrawl hoặc Browser Use key vào sessionStorage của trình duyệt.",
			},
			{
				title: "Tạo scan",
				body: "Từ Nguồn & Quét, mở Tạo scan mới và nhập Facebook, website, tệp hoặc văn bản theo đúng mục.",
			},
			{
				title: "Đọc phân tích",
				body: "Dùng trang Phân tích để xem tóm tắt, cụm chủ đề, cảm xúc, cảnh báo và bằng chứng liên quan.",
			},
			{
				title: "Duyệt phản hồi",
				body: "Mở Lập luận phản hồi để tạo hoặc duyệt bản nháp. Chỉ xuất khi nội dung đã được người vận hành phê duyệt.",
			},
		],
		notes: [
			"Khóa kiểm thử chỉ tồn tại trong session trình duyệt hiện tại.",
			"Thông báo trên thanh trên cùng dẫn nhanh đến scan, bản nháp và cảnh báo cần xử lý.",
			"Nếu API riêng tư trả 401, dashboard vẫn hiển thị dữ liệu mẫu để thao tác giao diện.",
		],
	},
	policies: {
		icon: ScrollText,
		title: "Chính sách & Quy định",
		description: "Ranh giới vận hành cho phân tích nguồn công khai và phản hồi nội bộ.",
		panelTitle: "Quy định bắt buộc",
		panelDescription: "Thiết kế cho kiểm duyệt nội bộ, không phải công cụ tự động đăng tải.",
		primaryAction: "Xem nhật ký",
		primaryHref: "/audit",
		steps: [
			{
				title: "Nguồn hợp lệ",
				body: "Chỉ dùng Facebook công khai, website tùy chỉnh, tệp được phép xử lý và văn bản do người vận hành cung cấp.",
			},
			{
				title: "Bảo mật khóa",
				body: "Server key luôn được ưu tiên. Browser key chỉ dùng cho kiểm thử phiên hiện tại và không được lưu vào cơ sở dữ liệu.",
			},
			{
				title: "Bằng chứng trước lập luận",
				body: "Mỗi phản hồi phải dựa trên evidence item đã lưu; không thêm tuyên bố chưa có trích dẫn hoặc nguồn hỗ trợ.",
			},
			{
				title: "Không nhắm mục tiêu nhạy cảm",
				body: "Không tạo nội dung phân phối theo nhân khẩu học, thuộc tính nhạy cảm hoặc hành vi thao túng người dùng.",
			},
			{
				title: "Duyệt thủ công",
				body: "Mọi bản nháp phản hồi giữ trạng thái cần duyệt cho đến khi người vận hành phê duyệt hoặc từ chối.",
			},
		],
		notes: [
			"Không thêm auto-posting, scheduler đăng bài hoặc tích hợp xuất bản trực tiếp.",
			"Audit trail phải ghi metadata chế độ chạy, không ghi raw key hoặc token.",
			"Chỉ xử lý nội dung theo quyền truy cập hợp lệ và quy định của tổ chức triển khai.",
		],
	},
} as const;
