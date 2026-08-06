"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";

import { LoginRedirect } from "@/components/auth/login-redirect";
import { useDashboardAuthState } from "@/components/dashboard/dashboard-auth-context";
import type { EvidenceFormValues } from "@/components/dashboard/dialogs";
import {
	createEvidenceRecord,
	createScan,
	createTrackedSourceRecord,
	deleteEvidenceRecord,
	deleteScanRecord,
	deleteTrackedSourceRecord,
	generateDraft,
	reviewDraft,
	reviseScanAnalysis,
	rewriteDraftWithAi,
	runScanRecord,
	runManagedSchedulerJobNow,
	updateDraftBody,
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
import { DeferredDialogLoading } from "@/components/dashboard/deferred-dialog-loading";
import type { DashboardPageProps } from "@/components/dashboard/dashboard-pages";
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
	parseStoredReportTemplates,
	REPORT_TEMPLATE_STORAGE_KEY,
	serializeStoredReportTemplates,
} from "@/lib/domain/report-template-storage";
import {
	dashboardInitialDataQueryOptions,
	scanDetailQueryOptions,
} from "@/lib/dashboard/client-queries";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { dashboardSnapshotRequirements } from "@/lib/dashboard/route-requirements";
import type { ScanProviderOverride } from "@/lib/domain/provider-override";

const loadDashboardPages = () => import("@/components/dashboard/dashboard-pages");
const loadDetailPages = () => import("@/components/dashboard/detail-pages");
const loadDialogs = () => import("@/components/dashboard/dialogs");

const OverviewPage = dynamic(() =>
	import("@/components/dashboard/overview").then(
		(module) => module.OverviewPage,
	),
);
const SourcesPage = dynamic(() =>
	import("@/components/dashboard/sources").then(
		(module) => module.SourcesPage,
	),
);
const AnalysisPage = dynamic(() =>
	import("@/components/dashboard/analysis-page").then(
		(module) => module.AnalysisPage,
	),
);
const TopicsPage = dynamic(() =>
	import("@/components/dashboard/topics-page").then(
		(module) => module.TopicsPage,
	),
);
const TopicDetailsPage = dynamic(() =>
	import("@/components/dashboard/topic-details-page").then(
		(module) => module.TopicDetailsPage,
	),
);
const CounterArgumentsPage = dynamic(() =>
	loadDashboardPages().then((module) => module.CounterArgumentsPage),
);
const EvidencePage = dynamic(() =>
	import("@/components/dashboard/evidence-page").then(
		(module) => module.EvidencePage,
	),
);
const ReportsPage = dynamic(() =>
	loadDashboardPages().then((module) => module.ReportsPage),
);
const SettingsPage = dynamic(() =>
	loadDashboardPages().then((module) => module.SettingsPage),
);
const AuditPage = dynamic(() =>
	import("@/components/dashboard/audit-page").then(
		(module) => module.AuditPage,
	),
);
const GuidePage = dynamic(() =>
	loadDashboardPages().then((module) => module.GuidePage),
);
const MembersPage = dynamic(() =>
	loadDashboardPages().then((module) => module.MembersPage),
);
const ChatPage = dynamic(() =>
	import("@/components/dashboard/chat-page").then((module) => module.ChatPage),
);
const ScanDetailsPage = dynamic(() =>
	loadDetailPages().then((module) => module.ScanDetailsPage),
);
const EvidenceDetailsPage = dynamic(() =>
	import("@/components/dashboard/evidence-details-page").then(
		(module) => module.EvidenceDetailsPage,
	),
);
const DraftDetailsPage = dynamic(() =>
	loadDetailPages().then((module) => module.DraftDetailsPage),
);

const ScanDialog = dynamic(
	() => loadDialogs().then((module) => module.ScanDialog),
	{
		loading: () => <DeferredDialogLoading label="Đang tải biểu mẫu scan" />,
		ssr: false,
	},
);
const CounterArgumentDialog = dynamic(
	() => loadDialogs().then((module) => module.CounterArgumentDialog),
	{ loading: () => <DeferredDialogLoading />, ssr: false },
);
const ScanEditDialog = dynamic(
	() => loadDialogs().then((module) => module.ScanEditDialog),
	{ loading: () => <DeferredDialogLoading />, ssr: false },
);
const EvidenceEditDialog = dynamic(
	() => loadDialogs().then((module) => module.EvidenceEditDialog),
	{ loading: () => <DeferredDialogLoading />, ssr: false },
);
const ReportPresetDialog = dynamic(
	() => loadDialogs().then((module) => module.ReportPresetDialog),
	{ loading: () => <DeferredDialogLoading />, ssr: false },
);
const ReportDialog = dynamic(
	() =>
		import("@/components/dashboard/report-dialog").then(
			(mod) => mod.ReportDialog,
		),
	{ loading: () => <DeferredDialogLoading label="Đang tải báo cáo" />, ssr: false },
);

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

const emptyScans: DashboardScan[] = [];
const emptyTrackedSources: TrackedSourceView[] = [];
const scanStatuses = new Set<DashboardScan["status"]>([
	"queued",
	"running",
	"completed",
	"failed",
	"retrying",
]);

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
	const router = useRouter();
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
	const [scansOverride, setScansOverride] = useState<DashboardScan[] | null>(null);
	const [trackedSourcesOverride, setTrackedSourcesOverride] = useState<
		TrackedSourceView[] | null
	>(null);
	const scans = scansOverride ?? hydratedInitialData?.scans ?? emptyScans;
	const trackedSources =
		trackedSourcesOverride ??
		hydratedInitialData?.trackedSources ??
		emptyTrackedSources;
	const setScans: Dispatch<SetStateAction<DashboardScan[]>> = useCallback(
		(value) => {
			setScansOverride((current) => {
				const base = current ?? dashboardQuery.data?.scans ?? initialData?.scans ?? [];
				return typeof value === "function" ? value(base) : value;
			});
		},
		[dashboardQuery.data?.scans, initialData?.scans],
	);
	const setTrackedSources: Dispatch<SetStateAction<TrackedSourceView[]>> =
		useCallback(
			(value) => {
				setTrackedSourcesOverride((current) => {
					const base =
						current ??
						dashboardQuery.data?.trackedSources ??
						initialData?.trackedSources ??
						[];
					return typeof value === "function" ? value(base) : value;
				});
			},
			[dashboardQuery.data?.trackedSources, initialData?.trackedSources],
		);
	const [selectedScanId, setSelectedScanId] = useState(
		() => scanId ?? hydratedInitialData?.selectedScanId ?? "",
	);
	const [detailOverride, setDetailOverride] = useState<ScanDetail | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [isDrafting, setIsDrafting] = useState(false);
	const [, setNotice] = useState(hydratedInitialData?.loadError ?? "");
	const [draft, setDraft] = useState<DraftShape | null>(
		() =>
			(hydratedInitialData?.detail?.drafts?.[0] as DraftShape | undefined) ??
			null,
	);
	const [tone, setTone] = useState<string>(
		composerOptions.tones[0] ?? "Điềm tĩnh, khách quan",
	);
	const [voice, setVoice] = useState<string>(
		composerOptions.voices[0] ?? "Tự nhiên, gần gũi",
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
	const [reportTemplatesHydrated, setReportTemplatesHydrated] = useState(false);
	const chatMessages: ChatMessage[] = initialChatMessages;
	const isChatting = false;
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
	const setDetail: Dispatch<SetStateAction<ScanDetail | null>> = useCallback(
		(value) => {
			setDetailOverride((current) => {
				const base =
					current ??
					detailQuery.data ??
					hydratedInitialData?.detail ??
					null;
				return typeof value === "function" ? value(base) : value;
			});
		},
		[detailQuery.data, hydratedInitialData?.detail],
	);

	const activeDetail = detailOverride ?? detailQuery.data ?? null;
	const selectedScan = useMemo(() => {
		const scan = scans.find((item) => item.id === activeScanId) ?? scans[0];
		const detailStatus = activeDetail?.job?.status;
		if (!scan || !isDashboardScanStatus(detailStatus)) return scan;
		if (scan.status === detailStatus) return scan;

		return {
			...scan,
			progress: scanProgressForStatus(detailStatus),
			status: detailStatus,
		};
	}, [activeDetail?.job?.status, activeScanId, scans]);
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

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			try {
				const stored = parseStoredReportTemplates(
					window.localStorage.getItem(REPORT_TEMPLATE_STORAGE_KEY),
				);
				setCustomReports(stored.customReports);
				setHiddenReportKinds(stored.hiddenReportKinds);
			} catch {
				// Storage can be unavailable in privacy-restricted browser contexts.
			}
			setReportTemplatesHydrated(true);
		}, 0);

		return () => window.clearTimeout(timeoutId);
	}, []);

	useEffect(() => {
		if (!reportTemplatesHydrated) return;
		try {
			window.localStorage.setItem(
				REPORT_TEMPLATE_STORAGE_KEY,
				serializeStoredReportTemplates(customReports, hiddenReportKinds),
			);
		} catch {
			// The report workflow still works in-memory when storage is unavailable.
		}
	}, [customReports, hiddenReportKinds, reportTemplatesHydrated]);

	function invalidateDashboardQueries(scanIdToInvalidate = activeScanId) {
		void scanIdToInvalidate;
		void (async () => {
			const initialKey = dashboardQueryKeys.initial({ ...requirements, scanId });
			const detailKey = dashboardQueryKeys.scanDetail(activeScanId);
			await queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.all,
				refetchType: "none",
			});

			const [initialResult, detailResult] = await Promise.allSettled([
				requirements.includeScans
					? queryClient.refetchQueries(
							{ exact: true, queryKey: initialKey, type: "active" },
							{ throwOnError: true },
						)
					: Promise.resolve(),
				shouldLoadDetail && activeScanId
					? queryClient.refetchQueries(
							{ exact: true, queryKey: detailKey, type: "active" },
							{ throwOnError: true },
						)
					: Promise.resolve(),
			]);

			if (initialResult.status === "fulfilled") {
				setScansOverride(null);
				setTrackedSourcesOverride(null);
			}
			if (detailResult.status === "fulfilled") {
				setDetailOverride(null);
				setDraft(null);
			}

			const refreshedQueryHashes = new Set(
				[initialKey, detailKey]
					.map(
						(key) =>
							queryClient.getQueryCache().find({ exact: true, queryKey: key })
								?.queryHash,
					)
					.filter((hash): hash is string => Boolean(hash)),
			);
			void queryClient.refetchQueries({
				predicate: (query) => !refreshedQueryHashes.has(query.queryHash),
				queryKey: dashboardQueryKeys.all,
				type: "active",
			});
		})();
	}

	if (!auth.authenticated) {
		return <LoginRedirect href={auth.loginHref ?? "/login?reason=expired"} />;
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
			const query = preset?.trim()
				? `?prompt=${encodeURIComponent(preset.trim())}`
				: "";
			router.push(`/chat${query}`);
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
			setNotice("Đã xóa mẫu báo cáo.");
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
		onRunScan: (scan, options) =>
			runScanRecord({
				force: options?.force,
				scan,
				setDetail,
				setNotice,
				setScans,
			}).then((success) => {
				if (success) invalidateDashboardQueries(scan.id);
			}),
		onReviseAnalysis: () =>
			reviseScanAnalysis({
				scanId: activeScanId,
				setDetail,
				setNotice,
			}).then((success) => {
				if (success) invalidateDashboardQueries(activeScanId);
				return success;
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
		onRunSchedulerJob: (jobKey) =>
			runManagedSchedulerJobNow({
				jobKey,
				setNotice,
			}).then((success) => {
				if (success) invalidateDashboardQueries();
			}),
		onReview: async (draftToReview, status) => {
			const success = await reviewDraft({
				draft: draftToReview,
				setDraft,
				setNotice,
				status,
			});
			if (success) invalidateDashboardQueries(draftToReview.scanJobId);
			return success;
		},
		onRewriteDraft: async (draftToRewrite, options) => {
			const updated = await rewriteDraftWithAi({
				draft: draftToRewrite,
				...options,
				setDraft,
				setNotice,
			});
			if (updated.draft) invalidateDashboardQueries(updated.draft.scanJobId);
			return updated;
		},
		onSaveDraft: async (draftToSave, body) => {
			const updated = await updateDraftBody({
				body,
				draft: draftToSave,
				setDraft,
				setNotice,
			});
			if (updated) invalidateDashboardQueries(updated.scanJobId);
			return updated;
		},
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
			setNotice("Đã tạo mẫu báo cáo.");
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
		setNotice("Đã cập nhật mẫu báo cáo.");
	};

	return (
		<>
			{renderPage(page, pageProps, { draftId, evidenceId, scanId, topicSlug })}
				{scanDialogOpen ? (
					<ScanDialog
					open
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
				onCreate={(runMode) =>
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
						runMode,
					}).then((success) => {
						if (success) invalidateDashboardQueries();
						return success;
					})
				}
					/>
				) : null}
				{draftDialogOpen ? (
					<CounterArgumentDialog
					open
				onClose={() => setDraftDialogOpen(false)}
				tone={tone}
				setTone={setTone}
				voice={voice}
				setVoice={setVoice}
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
						voice,
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
				) : null}
				{scanEditDialogOpen ? (
					<ScanEditDialog
					open
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
				) : null}
				{evidenceDialogOpen ? (
					<EvidenceEditDialog
					open
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
				) : null}
				{reportPresetDialogOpen ? (
					<ReportPresetDialog
					open
				onClose={() => setReportPresetDialogOpen(false)}
				report={reportPresetBeingEdited}
				onSubmit={onUpdateReport}
					/>
				) : null}
				{reportDialogOpen ? (
					<ReportDialog
					open
				onClose={() => setReportDialogOpen(false)}
				report={selectedReport}
				selectedScan={selectedScan}
				analysis={analysis}
				evidence={evidence}
				draft={activeDraft}
					/>
				) : null}
			</>
	);
}

function isDashboardScanStatus(value: unknown): value is DashboardScan["status"] {
	return (
		typeof value === "string" &&
		scanStatuses.has(value as DashboardScan["status"])
	);
}

function scanProgressForStatus(status: DashboardScan["status"]) {
	if (status === "completed") return 100;
	if (status === "running") return 45;
	if (status === "retrying") return 25;
	return 0;
}

function shouldLoadScanDetail(page: DashboardPage) {
	return ![
		"chat",
		"guide-policies",
		"guide-process",
		"guide-user",
		"alerts",
		"audit",
		"evidence",
		"members",
		"overview",
		"settings",
		"sources",
		"topics",
		"topic-detail",
	].includes(page);
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
			return <TopicsPage onOpenDraft={props.onOpenDraft} />;
		case "topic-detail":
			return <TopicDetailsPage topicSlug={routeIds.topicSlug} />;
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
			return <EvidencePage onCreateEvidence={props.onCreateEvidence} />;
		case "evidence-detail":
			return <EvidenceDetailsPage {...props} evidenceId={routeIds.evidenceId} />;
		case "draft-detail":
			return <DraftDetailsPage {...props} draftId={routeIds.draftId} />;
		case "reports":
			return <ReportsPage {...props} />;
		case "settings":
			return <SettingsPage />;
		case "audit":
			return <AuditPage />;
		case "guide-process":
			return <GuidePage kind="process" />;
		case "guide-user":
			return <GuidePage kind="user" />;
		case "guide-policies":
			return <GuidePage kind="policies" />;
		default:
			return (
				<OverviewPage
					onDeleteScan={props.onDeleteScan}
					onEditScan={props.onEditScan}
					onOpenDraft={props.onOpenDraft}
					onOpenScan={props.onOpenScan}
					onRunScan={props.onRunScan}
					onSelectScan={props.onSelectScan}
					scans={props.scans}
					selectedScanId={props.selectedScanId}
				/>
			);
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
