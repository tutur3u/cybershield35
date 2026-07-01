"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ChatDialog } from "@/components/dashboard/chat-dialog";
import { ChatPage } from "@/components/dashboard/chat-page";
import { useDashboardAuthState } from "@/components/dashboard/dashboard-auth-context";
import {
	CounterArgumentDialog,
	EvidenceEditDialog,
	ReportPresetDialog,
	ScanDialog,
	ScanEditDialog,
	type EvidenceFormValues,
} from "@/components/dashboard/dialogs";
import { ReportDialog } from "@/components/dashboard/report-dialog";
import {
	createEvidenceRecord,
	createScan,
	createTrackedSourceRecord,
	deleteEvidenceRecord,
	deleteScanRecord,
	deleteTrackedSourceRecord,
	generateDraft,
	reviewDraft,
	runScanRecord,
	sendChatMessage,
	scanTrackedSource,
	updateEvidenceRecord,
	updateScanRecord,
	updateTrackedSourceRecord,
} from "@/components/dashboard/client-actions";
import {
	composerOptions,
	reportSpecs,
	type SourceTab,
} from "@/components/dashboard/dashboard-data";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import {
	DraftDetailsPage,
	EvidenceDetailsPage,
	ScanDetailsPage,
} from "@/components/dashboard/detail-pages";
import {
	AlertsPage,
	AnalysisPage,
	AuditPage,
	CounterArgumentsPage,
	EvidencePage,
	GuidePage,
	MembersPage,
	OverviewPage,
	ReportsPage,
	SettingsPage,
	SourcesPage,
	TopicDetailsPage,
	TopicsPage,
	type DashboardPageProps,
} from "@/components/dashboard/dashboard-pages";
import type {
	AnalysisView,
	AuthViewState,
	ChatMessage,
	ClaimView,
	DashboardInitialData,
	DashboardScan,
	DashboardPage,
	DraftShape,
	EvidenceView,
	ReportSpec,
	ScanDetail,
	TrackedSourceView,
	TopicCluster,
	WorkspaceMembersResponse,
} from "@/components/dashboard/types";
import {
	dashboardInitialDataQueryOptions,
	scanDetailQueryOptions,
} from "@/lib/dashboard/client-queries";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { dashboardSnapshotRequirements } from "@/lib/dashboard/route-requirements";
import type { ScanProviderOverride } from "@/lib/domain/provider-override";

export type CyberShieldDashboardProps = {
	draftId?: string;
	evidenceId?: string;
	initialAuth?: AuthViewState;
	initialData?: DashboardInitialData;
	initialWorkspaceMembers?: WorkspaceMembersResponse;
	page?: DashboardPage;
	scanId?: string;
	topicSlug?: string;
};

export function CyberShieldDashboard({
	draftId,
	evidenceId,
	initialAuth,
	initialData,
	initialWorkspaceMembers,
	page = "overview",
	scanId,
	topicSlug,
}: CyberShieldDashboardProps) {
	const layoutAuth = useDashboardAuthState();
	const auth: AuthViewState = initialAuth ?? layoutAuth ?? { authenticated: false };
	const requirements = dashboardSnapshotRequirements(page);
	const queryClient = useQueryClient();
	const dashboardQuery = useQuery({
		...dashboardInitialDataQueryOptions({ ...requirements, scanId }),
		enabled: auth.authenticated && requirements.includeScans,
		initialData:
			initialData && requirements.includeScans ? initialData : undefined,
	});
	const hydratedInitialData = dashboardQuery.data ?? initialData;
	const [inputMode, setInputMode] = useState<SourceTab>("url");
	const [urlInput, setUrlInput] = useState("https://facebook.com/example/posts/1");
	const [manualText, setManualText] = useState("");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [scanProviderOverride, setScanProviderOverride] =
		useState<ScanProviderOverride>();
	const [operatorNotes, setOperatorNotes] = useState("");
	const [scans, setScans] = useState<DashboardScan[]>(
		() => hydratedInitialData?.scans ?? [],
	);
	const [trackedSources, setTrackedSources] = useState<TrackedSourceView[]>(
		() => hydratedInitialData?.trackedSources ?? [],
	);
	const [selectedScanId, setSelectedScanId] = useState(
		() => scanId ?? hydratedInitialData?.selectedScanId ?? "",
	);
	const [detail, setDetail] = useState<ScanDetail | null>(
		() => hydratedInitialData?.detail ?? null,
	);
	const [isCreating, setIsCreating] = useState(false);
	const [isDrafting, setIsDrafting] = useState(false);
	const [, setNotice] = useState(hydratedInitialData?.loadError ?? "");
	const [draft, setDraft] = useState<DraftShape | null>(
		() =>
			(hydratedInitialData?.detail?.drafts?.[0] as DraftShape | undefined) ??
			null,
	);
	const [tone, setTone] = useState(
		composerOptions.tones[0] ?? "Điềm tĩnh, khách quan",
	);
	const [audience, setAudience] = useState(
		composerOptions.audiences[0] ?? "Công chúng chung",
	);
	const [language, setLanguage] = useState(
		composerOptions.languages[0] ?? "Tiếng Việt",
	);
	const [length, setLength] = useState(composerOptions.lengths[1] ?? "Trung bình");
	const [scanDialogOpen, setScanDialogOpen] = useState(false);
	const [draftDialogOpen, setDraftDialogOpen] = useState(false);
	const [reportDialogOpen, setReportDialogOpen] = useState(false);
	const [selectedReport, setSelectedReport] = useState<ReportSpec | null>(null);
	const [reportPresetDialogOpen, setReportPresetDialogOpen] = useState(false);
	const [reportPresetBeingEdited, setReportPresetBeingEdited] =
		useState<ReportSpec | null>(null);
	const [customReports, setCustomReports] = useState<ReportSpec[]>([]);
	const [hiddenReportKinds, setHiddenReportKinds] = useState<string[]>([]);
	const [chatDialogOpen, setChatDialogOpen] = useState(false);
	const [chatDraft, setChatDraft] = useState("");
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
	const [isChatting, setIsChatting] = useState(false);
	const [scanEditDialogOpen, setScanEditDialogOpen] = useState(false);
	const [scanBeingEdited, setScanBeingEdited] = useState<DashboardScan | null>(
		null,
	);
	const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
	const [evidenceBeingEdited, setEvidenceBeingEdited] = useState<
		EvidenceView[number] | null
	>(null);
	const activeScanId = scanId ?? selectedScanId;
	const shouldLoadDetail = shouldLoadScanDetail(page);
	const detailQuery = useQuery({
		...scanDetailQueryOptions(activeScanId),
		enabled: auth.authenticated && shouldLoadDetail && Boolean(activeScanId),
		initialData:
			hydratedInitialData?.detail &&
			activeScanId === hydratedInitialData.selectedScanId
				? hydratedInitialData.detail
				: undefined,
	});

	const selectedScan = useMemo(
		() => scans.find((scan) => scan.id === activeScanId) ?? scans[0],
		[activeScanId, scans],
	);
	const activeDetail = detail ?? detailQuery.data ?? null;
	const activeDraft =
		draft ?? (activeDetail?.drafts?.[0] as DraftShape | undefined) ?? null;
	const analysis = toAnalysisView(activeDetail?.analysis);
	const evidence = activeDetail?.evidence ?? [];
	const topics = analysis.topicClusters;
	const reports = useMemo(
		() => [
			...reportSpecs.filter((report) => !hiddenReportKinds.includes(report.kind)),
			...customReports,
		],
		[customReports, hiddenReportKinds],
	);

	function invalidateDashboardQueries(scanIdToInvalidate = activeScanId) {
		void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all });
		if (scanIdToInvalidate) {
			void queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.scanDetail(scanIdToInvalidate),
			});
		}
	}

	if (!auth.authenticated) {
		return (
			<LockedDashboard
				error={auth.error}
				loginHref={auth.loginHref}
				scopeApprovalHref={auth.scopeApprovalHref}
			/>
		);
	}

	if (
		requirements.includeScans &&
		dashboardQuery.isPending &&
		!dashboardQuery.data
	) {
		return <DashboardPageSkeleton />;
	}

	const pageProps: DashboardPageProps = {
		scans,
		selectedScan,
		selectedScanId: activeScanId,
		detail: activeDetail,
		analysis,
		topics,
		evidence,
		draft: activeDraft,
		chatMessages,
		isChatting,
		isCreating,
		trackedSources,
		initialWorkspaceMembers,
		auth,
		onSelectScan: (id) => {
			setSelectedScanId(id);
			setDetail(null);
			setDraft(null);
		},
		onOpenScan: () => setScanDialogOpen(true),
		onOpenDraft: () => setDraftDialogOpen(true),
		onOpenChatComposer: (preset) => {
			setChatDraft(preset ?? "");
			setChatDialogOpen(true);
		},
		onPrepareReport: (report) => {
			setSelectedReport(report);
			setReportDialogOpen(true);
		},
		onCreateReport: () => {
			setReportPresetBeingEdited(null);
			setReportPresetDialogOpen(true);
		},
		onEditReport: (report) => {
			setReportPresetBeingEdited(report);
			setReportPresetDialogOpen(true);
		},
		onDeleteReport: (report) => {
			if (report.kind.startsWith("custom-")) {
				setCustomReports((current) =>
					current.filter((item) => item.kind !== report.kind),
				);
			} else {
				setHiddenReportKinds((current) =>
					current.includes(report.kind) ? current : [...current, report.kind],
				);
			}
			if (selectedReport?.kind === report.kind) setReportDialogOpen(false);
			setNotice("Đã xóa preset báo cáo.");
		},
		onCreateEvidence: () => {
			setEvidenceBeingEdited(null);
			setEvidenceDialogOpen(true);
		},
		onEditEvidence: (item) => {
			setEvidenceBeingEdited(item);
			setEvidenceDialogOpen(true);
		},
		onDeleteEvidence: (item) =>
			deleteEvidenceRecord({
				evidence: item,
				setDetail,
				setNotice,
			}).then((success) => {
				if (success) invalidateDashboardQueries(item.scanJobId ?? activeScanId);
			}),
		onEditScan: (scan) => {
			setScanBeingEdited(scan);
			setScanEditDialogOpen(true);
		},
		onDeleteScan: (scan) =>
			deleteScanRecord({
				scan,
				selectedScanId: activeScanId,
				setDetail,
				setDraft,
				setNotice,
				setScans,
				setSelectedScanId,
			}).then((success) => {
				if (success) invalidateDashboardQueries(scan.id);
			}),
		onRunScan: (scan) =>
			runScanRecord({
				scan,
				setDetail,
				setNotice,
				setScans,
			}).then((success) => {
				if (success) invalidateDashboardQueries(scan.id);
			}),
		onCreateTrackedSource: (input) =>
			createTrackedSourceRecord({
				...input,
				setNotice,
				setTrackedSources,
			}).then((success) => {
				if (success) invalidateDashboardQueries();
				return success;
			}),
		onUpdateTrackedSource: (trackedSource, input) =>
			updateTrackedSourceRecord({
				...input,
				setNotice,
				setTrackedSources,
				trackedSource,
			}).then((success) => {
				if (success) invalidateDashboardQueries();
				return success;
			}),
		onDeleteTrackedSource: (trackedSource) =>
			deleteTrackedSourceRecord({
				setNotice,
				setTrackedSources,
				trackedSource,
			}).then((success) => {
				if (success) invalidateDashboardQueries();
				return success;
			}),
		onScanTrackedSource: (trackedSource) =>
			scanTrackedSource({
				trackedSource,
				setIsCreating,
				setTrackedSources,
				setScans,
				setSelectedScanId,
				setNotice,
			}).then((success) => {
				if (success) invalidateDashboardQueries();
			}),
		onReview: (status) =>
			activeDraft
				? reviewDraft({ draft: activeDraft, status, setDraft, setNotice }).then(
						(success) => {
							if (success) invalidateDashboardQueries(activeDraft.scanJobId);
						},
					)
				: Promise.resolve(setNotice("Chưa có bản nháp live để duyệt.")),
		reports,
	};

	const onUpdateReport = (
		values: { description: string; sections: string[]; title: string },
		report: ReportSpec | null,
	) => {
		if (!report) {
			setCustomReports((current) => [
				...current,
				{ ...values, kind: createCustomReportKind() },
			]);
			setNotice("Đã tạo preset báo cáo.");
			return;
		}

		const nextReport = { ...report, ...values };
		if (report.kind.startsWith("custom-")) {
			setCustomReports((current) =>
				current.map((item) => (item.kind === report.kind ? nextReport : item)),
			);
		} else {
			setHiddenReportKinds((current) =>
				current.includes(report.kind) ? current : [...current, report.kind],
			);
			setCustomReports((current) => [
				...current,
				{ ...nextReport, kind: createCustomReportKind() },
			]);
		}
		setNotice("Đã cập nhật preset báo cáo.");
	};

	return (
		<>
			{renderPage(page, pageProps, { draftId, evidenceId, scanId, topicSlug })}
			<ScanDialog
				open={scanDialogOpen}
				onClose={() => setScanDialogOpen(false)}
				inputMode={inputMode}
				setInputMode={setInputMode}
				urlInput={urlInput}
				setUrlInput={setUrlInput}
				manualText={manualText}
				setManualText={setManualText}
				selectedFile={selectedFile}
				setSelectedFile={setSelectedFile}
				providerOverride={scanProviderOverride}
				setProviderOverride={setScanProviderOverride}
				isCreating={isCreating}
				onCreate={() =>
					createScan({
						inputMode,
						urlInput,
						manualText,
						selectedFile,
						providerOverride: scanProviderOverride,
						setIsCreating,
						setScans,
						setSelectedScanId,
						setNotice,
					}).then((success) => {
						if (success) invalidateDashboardQueries();
						return success;
					})
				}
			/>
			<CounterArgumentDialog
				open={draftDialogOpen}
				onClose={() => setDraftDialogOpen(false)}
				tone={tone}
				setTone={setTone}
				audience={audience}
				setAudience={setAudience}
				language={language}
				setLanguage={setLanguage}
				length={length}
				setLength={setLength}
				operatorNotes={operatorNotes}
				setOperatorNotes={setOperatorNotes}
				isDrafting={isDrafting}
				onGenerate={() =>
					generateDraft({
						selectedScanId: activeScanId,
						tone,
						audience,
						language,
						length,
						operatorNotes,
						setIsDrafting,
						setDraft,
						setNotice,
					}).then((success) => {
						if (success) invalidateDashboardQueries(activeScanId);
						return success;
					})
				}
			/>
			<ScanEditDialog
				open={scanEditDialogOpen}
				onClose={() => setScanEditDialogOpen(false)}
				scan={scanBeingEdited}
				onSave={(scan, values) =>
					updateScanRecord({
						scan,
						setNotice,
						setScans,
						status: values.status,
						title: values.title,
					}).then((success) => {
						if (success) invalidateDashboardQueries(scan.id);
						return success;
					})
				}
			/>
			<EvidenceEditDialog
				open={evidenceDialogOpen}
				onClose={() => setEvidenceDialogOpen(false)}
				evidence={evidenceBeingEdited}
				scanId={activeScanId}
				onSubmit={(values: EvidenceFormValues, item) =>
					item
						? updateEvidenceRecord({
								evidence: item,
								setDetail,
								setNotice,
								values,
							}).then((success) => {
								if (success) {
									invalidateDashboardQueries(item.scanJobId ?? activeScanId);
								}
								return success;
							})
						: createEvidenceRecord({
								scanId: activeScanId,
								setDetail,
								setNotice,
								values,
							}).then((success) => {
								if (success) invalidateDashboardQueries(activeScanId);
								return success;
							})
				}
			/>
			<ReportPresetDialog
				open={reportPresetDialogOpen}
				onClose={() => setReportPresetDialogOpen(false)}
				report={reportPresetBeingEdited}
				onSubmit={onUpdateReport}
			/>
			<ReportDialog
				open={reportDialogOpen}
				onClose={() => setReportDialogOpen(false)}
				report={selectedReport}
				selectedScan={selectedScan}
				analysis={analysis}
				evidence={evidence}
				draft={activeDraft}
			/>
			<ChatDialog
				open={chatDialogOpen}
				onClose={() => setChatDialogOpen(false)}
				draft={chatDraft}
				setDraft={setChatDraft}
				isSending={isChatting}
				onSend={(content) =>
					sendChatMessage({
						messages: chatMessages,
						content,
						setIsChatting,
						setMessages: setChatMessages,
						setNotice,
					})
				}
			/>
		</>
	);
}

function shouldLoadScanDetail(page: DashboardPage) {
	return ![
		"chat",
		"guide-policies",
		"guide-process",
		"guide-user",
		"members",
		"settings",
		"sources",
		"topics",
		"topic-detail",
	].includes(page);
}

export function LockedDashboard({
	error,
	loginHref,
	scopeApprovalHref,
}: {
	error?: string;
	loginHref?: string;
	scopeApprovalHref?: string;
}) {
	return (
		<main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] sm:px-6">
			<div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
				<section className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
					<div className="flex items-start gap-3">
						<span className="grid size-12 shrink-0 place-items-center rounded-md bg-[var(--success-soft)] text-[var(--brand)]">
							<svg
								aria-hidden="true"
								viewBox="0 0 24 24"
								className="size-6"
								fill="none"
								stroke="currentColor"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
							>
								<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
								<path d="m9 12 2 2 4-4" />
							</svg>
						</span>
						<div className="min-w-0">
							<p className="text-[13px] font-bold uppercase tracking-[0.04em] text-[var(--brand)]">
								CyberShield 35
							</p>
							<h1 className="mt-1 text-[22px] font-bold leading-7 text-[var(--foreground)]">
								Đăng nhập để tiếp tục
							</h1>
							<p className="mt-2 text-[13px] leading-5 text-[var(--muted)]">
								{error ??
									"Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại để mở bảng điều khiển."}
							</p>
						</div>
					</div>

					{loginHref ? (
						<a
							href={loginHref}
							className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--accent)] px-4 text-[13px] font-bold text-white shadow-sm transition hover:bg-[var(--accent-strong)]"
						>
							Đăng nhập lại
						</a>
					) : (
						<button
							type="button"
							disabled
							className="mt-6 inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-md bg-[var(--surface-soft)] px-4 text-[13px] font-bold text-[var(--muted)]"
						>
							Đăng nhập chưa khả dụng
						</button>
					)}
					{scopeApprovalHref ? (
						<a
							href={scopeApprovalHref}
							className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 text-[12px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
						>
							Duyệt quyền truy cập
						</a>
					) : null}
				</section>
			</div>
		</main>
	);
}

function renderPage(
	page: DashboardPage,
	props: DashboardPageProps,
	routeIds: {
		draftId?: string;
		evidenceId?: string;
		scanId?: string;
		topicSlug?: string;
	},
) {
	switch (page) {
		case "sources":
			return <SourcesPage {...props} />;
		case "analysis":
			return <AnalysisPage {...props} />;
		case "topics":
			return <TopicsPage {...props} />;
		case "topic-detail":
			return <TopicDetailsPage {...props} topicSlug={routeIds.topicSlug} />;
		case "counter-arguments":
			return <CounterArgumentsPage {...props} />;
		case "chat":
			return (
				<ChatPage
					messages={props.chatMessages}
					isSending={props.isChatting}
					onOpenComposer={props.onOpenChatComposer}
				/>
			);
		case "members":
			return <MembersPage initialData={props.initialWorkspaceMembers} />;
		case "scan-detail":
			return <ScanDetailsPage {...props} scanId={routeIds.scanId} />;
		case "evidence":
			return <EvidencePage {...props} />;
		case "evidence-detail":
			return <EvidenceDetailsPage {...props} evidenceId={routeIds.evidenceId} />;
		case "draft-detail":
			return <DraftDetailsPage {...props} draftId={routeIds.draftId} />;
		case "alerts":
			return <AlertsPage {...props} />;
		case "reports":
			return <ReportsPage {...props} />;
		case "settings":
			return <SettingsPage />;
		case "audit":
			return <AuditPage {...props} />;
		case "guide-process":
			return <GuidePage kind="process" />;
		case "guide-user":
			return <GuidePage kind="user" />;
		case "guide-policies":
			return <GuidePage kind="policies" />;
		default:
			return <OverviewPage {...props} />;
	}
}

const initialChatMessages: ChatMessage[] = [
	{
		id: "chat-welcome",
		role: "assistant",
		content:
			"Tôi có thể hỗ trợ phân tích rủi ro, kiểm tra bằng chứng và gợi ý phản hồi nội bộ. Nội dung chat không tự động đăng tải.",
		createdAt: new Date().toISOString(),
	},
];

const emptyAnalysis: AnalysisView = {
	claims: [],
	riskLevel: "low",
	summary: "Chưa có phân tích live. Hãy tạo hoặc chọn một scan đã xử lý.",
	stanceSummary: "Chưa có dữ liệu",
	topicClusters: [],
	riskFlags: [],
	sentiment: { positive: 0, neutral: 0, negative: 0, total: 0 },
};

function toAnalysisView(input: ScanDetail["analysis"]): AnalysisView {
	if (!input) return emptyAnalysis;

	return {
		...input,
		riskLevel: input.riskLevel ?? "low",
		summary: input.summary ?? emptyAnalysis.summary,
		stanceSummary: input.stanceSummary ?? emptyAnalysis.stanceSummary,
		topicClusters: isTopicClusterArray(input.topicClusters)
			? input.topicClusters
			: [],
		claims: isClaimArray(input.claims) ? input.claims : [],
		riskFlags: isRiskFlagArray(input.riskFlags) ? input.riskFlags : [],
		sentiment: normalizeSentiment(input.sentiment),
	};
}

function normalizeSentiment(input: unknown): AnalysisView["sentiment"] {
	if (!input || typeof input !== "object") return emptyAnalysis.sentiment;
	const value = input as Partial<AnalysisView["sentiment"]>;
	return {
		positive: Number(value.positive ?? 0),
		neutral: Number(value.neutral ?? 0),
		negative: Number(value.negative ?? 0),
		total: Number(value.total ?? 0),
	};
}

function isTopicClusterArray(input: unknown): input is TopicCluster[] {
	return Array.isArray(input);
}

function isRiskFlagArray(input: unknown): input is AnalysisView["riskFlags"] {
	return Array.isArray(input);
}

function isClaimArray(input: unknown): input is ClaimView[] {
	return (
		Array.isArray(input) &&
		input.every((item) => {
			if (!item || typeof item !== "object") return false;
			const claim = item as Partial<ClaimView>;
			return (
				typeof claim.claim === "string" &&
				typeof claim.stance === "string" &&
				typeof claim.confidence === "number" &&
				Array.isArray(claim.evidenceIds) &&
				claim.evidenceIds.every((id) => typeof id === "string")
			);
		})
	);
}

function createCustomReportKind() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return `custom-${crypto.randomUUID()}`;
	}

	return `custom-${Date.now()}`;
}
