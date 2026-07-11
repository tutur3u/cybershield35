"use client";

import {
	ArrowRight,
	CheckCircle2,
	Database,
	Edit3,
	FileBarChart,
	FileText,
	MessageSquareText,
	Plus,
	Radar,
	ScrollText,
	ShieldCheck,
	Sparkles,
	Trash2,
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
import { IntelligenceReportsWorkbench } from "@/components/dashboard/intelligence-widgets";
import {
	AnalysisSummary,
	PageHeader,
} from "@/components/dashboard/page-widgets";
import type {
	AnalysisView,
	AuthViewState,
	ChatMessage,
	DashboardScan,
	DraftShape,
	EvidenceView,
	ReportSpec,
	ScanDetail,
	TrackedSourceView,
	TopicCluster,
	WorkspaceMembersResponse,
} from "@/components/dashboard/types";
import {
	Panel,
	PanelHeader,
	SecondaryButton,
} from "@/components/dashboard/ui-primitives";
import { WorkspaceMembersPage } from "@/components/dashboard/workspace-members-page";

export type DashboardPageProps = {
	scans: DashboardScan[];
	selectedScan?: DashboardScan;
	selectedScanId: string;
	detail: ScanDetail | null;
	analysis: AnalysisView;
	topics: TopicCluster[];
	evidence: EvidenceView;
	draft: DraftShape | null;
	chatMessages: ChatMessage[];
	isChatting: boolean;
	isCreating: boolean;
	initialWorkspaceMembers?: WorkspaceMembersResponse;
	trackedSources: TrackedSourceView[];
	auth: AuthViewState;
	onSelectScan: (id: string) => void;
	onOpenScan: () => void;
	onOpenDraft: () => void;
	onOpenChatComposer: (preset?: string) => void;
	onPrepareReport: (report: ReportSpec) => void;
	onCreateReport: () => void;
	onEditReport: (report: ReportSpec) => void;
	onDeleteReport: (report: ReportSpec) => void;
	onCreateEvidence: () => void;
	onEditEvidence: (evidence: EvidenceView[number]) => void;
	onDeleteEvidence: (evidence: EvidenceView[number]) => Promise<void>;
	onEditScan: (scan: DashboardScan) => void;
	onDeleteScan: (scan: DashboardScan) => Promise<void>;
	onRunScan: (scan: DashboardScan) => Promise<void>;
	onCreateTrackedSource: (input: {
		displayName: string;
		url: string;
	}) => Promise<boolean>;
	onUpdateTrackedSource: (
		source: TrackedSourceView,
		input: { displayName?: string; isActive?: boolean },
	) => Promise<boolean>;
	onDeleteTrackedSource: (source: TrackedSourceView) => Promise<boolean>;
	onScanTrackedSource: (source: TrackedSourceView) => Promise<void>;
	onRunSchedulerJob: (
		jobKey: "enqueue-tracked-sources" | "process-queue",
	) => Promise<void>;
	onReview: (status: "needs_review" | "approved" | "rejected") => Promise<void>;
	reports: ReportSpec[];
};

export function MembersPage({
	initialData,
}: {
	initialData?: WorkspaceMembersResponse;
}) {
	return <WorkspaceMembersPage initialData={initialData} />;
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
					<TopicPanel evidence={props.evidence} topics={props.topics} />
					<RiskFlagPanel
						analysis={props.analysis}
						evidence={props.evidence}
						scanId={props.selectedScanId}
					/>
				</div>
				<div className="grid gap-5 xl:grid-rows-[auto_minmax(0,1fr)]">
					<SentimentAndStance analysis={props.analysis} className="h-full" />
					<AlertPanel
						flags={props.analysis.riskFlags}
						evidence={props.evidence}
						scanId={props.selectedScanId}
						className="h-full"
					/>
				</div>
				<div className="xl:col-span-2">
					<EvidencePanel
						enableInfinite
						evidence={props.evidence}
						limit={5}
						scanId={props.selectedScanId}
					/>
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
					<EvidencePanel
						enableInfinite
						evidence={props.evidence}
						limit={8}
						scanId={props.selectedScanId}
					/>
				</div>
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
				actions={
					<SecondaryButton onClick={props.onCreateReport}>
						<Plus size={14} /> Tạo preset
					</SecondaryButton>
				}
			/>
			<IntelligenceReportsWorkbench onCreateReport={props.onCreateReport} />
			<div className="grid items-stretch gap-4 md:grid-cols-3">
				{props.reports.map((report) => (
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
							<div className="mt-4 flex flex-wrap gap-2">
								<SecondaryButton onClick={() => props.onPrepareReport(report)}>
									<FileBarChart size={14} /> Chuẩn bị báo cáo
								</SecondaryButton>
								<button
									type="button"
									onClick={() => props.onEditReport(report)}
									className="grid size-10 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
									aria-label="Chỉnh preset báo cáo"
								>
									<Edit3 size={14} />
								</button>
								<button
									type="button"
									onClick={() => props.onDeleteReport(report)}
									className="grid size-10 place-items-center rounded-md border border-[var(--danger-border)] text-[var(--danger-strong)] transition hover:bg-[var(--danger-soft)]"
									aria-label="Xóa preset báo cáo"
								>
									<Trash2 size={14} />
								</button>
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
							value={props.selectedScan?.title ?? "Chưa chọn"}
						/>
						<ReportReadiness label="Bằng chứng" value={`${props.evidence.length} mục`} />
						<ReportReadiness
							label="Bản nháp"
							value={reportDraftStatus(props.draft?.status)}
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

export function SettingsPage() {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={ShieldCheck}
				title="Cấu hình"
				description="Mở menu tài khoản để xem cấu hình máy chủ trong hộp thoại."
			/>
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
				body: "Hệ thống chọn adapter dựa trên nguồn và chỉ sử dụng key được cấu hình bằng biến môi trường server-side.",
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
			"Khi dữ liệu live chưa đủ, tạo scan mới hoặc cấu hình provider còn thiếu thay vì suy diễn kết quả.",
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
				title: "Phiên đăng nhập",
				body: "Admin cấu hình auth bằng biến môi trường server-side, redeploy ứng dụng, rồi người vận hành mở lại dashboard.",
			},
			{
				title: "Kiểm tra cấu hình server",
				body: "Trong Cấu hình, kiểm tra Google AI, Apify, Firecrawl và Browser Use đã có key server-side trước khi tạo scan.",
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
			"Không nhập hoặc lưu khóa provider trong trình duyệt.",
			"Nhật ký hoạt động ghi lại các thao tác vận hành quan trọng để truy vết sau mỗi phiên.",
			"Nếu API riêng tư trả 401, hãy kiểm tra phiên đăng nhập và cấu hình server trước khi thao tác.",
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
				body: "Provider và LLM key chỉ được cấu hình bằng biến môi trường server-side; không nhập khóa vào trình duyệt.",
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
