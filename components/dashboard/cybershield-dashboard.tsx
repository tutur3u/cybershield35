"use client";

import { useEffect, useMemo, useState } from "react";

import { ChatDialog } from "@/components/dashboard/chat-dialog";
import { ChatPage } from "@/components/dashboard/chat-page";
import { useDashboardAuthState } from "@/components/dashboard/dashboard-auth-context";
import { Dialog } from "@/components/dashboard/dialog-frame";
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
	logout,
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
	OverviewPage,
	ReportsPage,
	SettingsPage,
	SourcesPage,
	type DashboardPageProps,
} from "@/components/dashboard/dashboard-pages";
import { ProviderStatus } from "@/components/dashboard/page-widgets";
import { ProfileSettingsPanel } from "@/components/dashboard/profile-settings-panel";
import { Sidebar, TopBar } from "@/components/dashboard/shell";
import { useThemePreference } from "@/components/dashboard/theme";
import type { ScanProviderOverride } from "@/lib/domain/provider-override";
import type {
	AnalysisView,
	AdminSessionView,
	AuthViewState,
	ChatMessage,
	DashboardScan,
	DashboardPage,
	DraftShape,
	EvidenceView,
	ProviderAvailabilityView,
	ReportSpec,
	ScanDetail,
	TrackedSourceView,
	TopicCluster,
} from "@/components/dashboard/types";

export type CyberShieldDashboardProps = {
	draftId?: string;
	evidenceId?: string;
	initialAuth?: AuthViewState;
	page?: DashboardPage;
	scanId?: string;
};

export function CyberShieldDashboard({
	draftId,
	evidenceId,
	initialAuth,
	page = "overview",
	scanId,
}: CyberShieldDashboardProps) {
	const layoutAuth = useDashboardAuthState();
	const [inputMode, setInputMode] = useState<SourceTab>("url");
	const [urlInput, setUrlInput] = useState("https://facebook.com/example/posts/1");
	const [manualText, setManualText] = useState("");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [scanProviderOverride, setScanProviderOverride] =
		useState<ScanProviderOverride>();
	const [operatorNotes, setOperatorNotes] = useState("");
	const [scans, setScans] = useState<DashboardScan[]>([]);
	const [trackedSources, setTrackedSources] = useState<TrackedSourceView[]>([]);
	const [selectedScanId, setSelectedScanId] = useState(scanId ?? "");
	const [detail, setDetail] = useState<ScanDetail | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [isDrafting, setIsDrafting] = useState(false);
	const [, setNotice] = useState("");
	const [auth, setAuth] = useState<AuthViewState>(
		initialAuth ?? layoutAuth ?? { authenticated: false },
	);
	const [draft, setDraft] = useState<DraftShape | null>(null);
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
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [profileDialogOpen, setProfileDialogOpen] = useState(false);
	const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
	const [scanEditDialogOpen, setScanEditDialogOpen] = useState(false);
	const [scanBeingEdited, setScanBeingEdited] = useState<DashboardScan | null>(
		null,
	);
	const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
	const [evidenceBeingEdited, setEvidenceBeingEdited] = useState<
		EvidenceView[number] | null
	>(null);
	const [providerAvailability, setProviderAvailability] =
		useState<ProviderAvailabilityView | null>(null);
	const { preference, resolvedTheme, setPreference } = useThemePreference();
	const activeScanId = scanId ?? selectedScanId;

	const selectedScan = useMemo(
		() => scans.find((scan) => scan.id === activeScanId) ?? scans[0],
		[activeScanId, scans],
	);
	const analysis = toAnalysisView(detail?.analysis);
	const evidence = detail?.evidence ?? [];
	const topics = analysis.topicClusters;
	const reports = useMemo(
		() => [
			...reportSpecs.filter((report) => !hiddenReportKinds.includes(report.kind)),
			...customReports,
		],
		[customReports, hiddenReportKinds],
	);

	useEffect(() => {
		let alive = true;
		const nextUrl = `${window.location.pathname}${window.location.search}`;
		fetch(`/api/admin/session?nextUrl=${encodeURIComponent(nextUrl)}`, {
			cache: "no-store",
		})
			.then(async (response) => {
				const payload = await response.json();
				if (!alive) return;
				if (response.ok && payload.session) {
					setAuth({
						authenticated: true,
						configured: true,
						loginHref: payload.loginHref,
						session: payload.session,
					});
					setNotice("Đã xác thực bằng Tuturuuu external app login.");
				} else {
					setAuth({
						authenticated: false,
						configured: payload.configured,
						error: payload.error,
						loginHref: payload.loginHref,
						scopeApprovalHref: payload.scopeApprovalHref,
					});
				}
			})
			.catch(() =>
				setAuth((current) => ({
					authenticated: false,
					error: "Không thể kiểm tra phiên Tuturuuu.",
					loginHref: current.loginHref,
				})),
			);

		return () => {
			alive = false;
		};
	}, []);

	useEffect(() => {
		if (!auth.authenticated) {
			return;
		}

		let alive = true;
		fetch("/api/scans", { cache: "no-store" })
			.then((response) => response.json())
			.then((payload: { scans?: DashboardScan[]; mode?: string }) => {
				if (!alive) return;
				if (!payload.scans?.length) {
					setScans([]);
					setSelectedScanId(scanId ?? "");
					setDetail(null);
					setDraft(null);
					return;
				}
				const firstScan = payload.scans[0];
				if (!firstScan) return;
				setScans(payload.scans);
				if (!scanId) setSelectedScanId(firstScan.id);
				setNotice("Đang đọc hàng đợi từ Postgres.");
			})
			.catch(() => setNotice("Không thể tải hàng đợi scan live."));

		fetch("/api/health", { cache: "no-store" })
			.then((response) => response.json())
			.then((payload: { providers?: ProviderAvailabilityView }) => {
				if (!alive) return;
				setProviderAvailability(payload.providers ?? null);
			})
			.catch(() => setProviderAvailability(null));

		fetch("/api/tracked-sources", { cache: "no-store" })
			.then((response) => response.json())
			.then((payload: { trackedSources?: TrackedSourceView[] }) => {
				if (!alive || !payload.trackedSources) return;
				setTrackedSources(payload.trackedSources);
			})
			.catch(() => setTrackedSources([]));

		return () => {
			alive = false;
		};
	}, [auth.authenticated, scanId]);

	useEffect(() => {
		if (!auth.authenticated || !activeScanId) {
			return;
		}

		let alive = true;
		fetch(`/api/scans/${activeScanId}`, { cache: "no-store" })
			.then((response) => response.json())
			.then((payload: { detail?: ScanDetail }) => {
				if (!alive) return;
				setDetail(payload.detail ?? null);
				setDraft((payload.detail?.drafts?.[0] as DraftShape | undefined) ?? null);
			})
			.catch(() => {
				setDetail(null);
				setDraft(null);
			});

		return () => {
			alive = false;
		};
	}, [auth.authenticated, activeScanId]);

	const pageProps: DashboardPageProps = {
		scans,
		selectedScan,
		selectedScanId: activeScanId,
		detail,
		analysis,
		topics,
		evidence,
		draft,
		providerAvailability,
		chatMessages,
		isChatting,
		isCreating,
		trackedSources,
		auth,
		onSelectScan: setSelectedScanId,
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
			}).then(() => undefined),
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
			}).then(() => undefined),
		onRunScan: (scan) =>
			runScanRecord({
				scan,
				setDetail,
				setNotice,
				setScans,
			}).then(() => undefined),
		onCreateTrackedSource: (input) =>
			createTrackedSourceRecord({
				...input,
				setNotice,
				setTrackedSources,
			}),
		onUpdateTrackedSource: (trackedSource, input) =>
			updateTrackedSourceRecord({
				...input,
				setNotice,
				setTrackedSources,
				trackedSource,
			}),
		onDeleteTrackedSource: (trackedSource) =>
			deleteTrackedSourceRecord({
				setNotice,
				setTrackedSources,
				trackedSource,
			}),
		onScanTrackedSource: (trackedSource) =>
			scanTrackedSource({
				trackedSource,
				setIsCreating,
				setTrackedSources,
				setScans,
				setSelectedScanId,
				setNotice,
			}).then(() => undefined),
		onReview: (status) =>
			draft
				? reviewDraft({ draft, status, setDraft, setNotice })
				: Promise.resolve(setNotice("Chưa có bản nháp live để duyệt.")),
		onProfileUpdated: (session: AdminSessionView) => {
			setAuth((current) => ({
				...current,
				authenticated: true,
				configured: true,
				session,
			}));
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

	if (!auth.authenticated) {
		return (
			<LockedDashboard
				error={auth.error}
				loginHref={auth.loginHref}
				scopeApprovalHref={auth.scopeApprovalHref}
			/>
		);
	}

	return (
		<main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
			<div
				className={`min-h-screen transition-[padding] duration-200 ${
					sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-[248px]"
				}`}
			>
				<Sidebar
					collapsed={sidebarCollapsed}
					onToggle={() => setSidebarCollapsed((current) => !current)}
				/>
				<section className="min-w-0 lg:h-screen lg:overflow-y-auto">
					<TopBar
						auth={auth}
						onLogout={() => logout(setAuth, setNotice, auth.loginHref)}
						onOpenProfile={() => setProfileDialogOpen(true)}
						onOpenSettings={() => setSettingsDialogOpen(true)}
						onSelectTheme={setPreference}
						resolvedTheme={resolvedTheme}
						themePreference={preference}
					/>
					<div className="flex-1 px-3 py-4 sm:px-5 lg:px-6 lg:py-6">
						{renderPage(page, pageProps, { draftId, evidenceId, scanId })}
					</div>
				</section>
			</div>
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
							})
						: createEvidenceRecord({
								scanId: activeScanId,
								setDetail,
								setNotice,
								values,
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
				draft={draft}
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
			<Dialog
				open={profileDialogOpen}
				onClose={() => setProfileDialogOpen(false)}
				title="Hồ sơ Tuturuuu"
				description="Tên hiển thị và ảnh đại diện cho phiên đang đăng nhập."
				size="wide"
			>
				<ProfileSettingsPanel
					auth={auth}
					embedded
					onProfileUpdated={(session) => {
						setAuth((current) => ({
							...current,
							authenticated: true,
							configured: true,
							session,
						}));
					}}
				/>
			</Dialog>
			<Dialog
				open={settingsDialogOpen}
				onClose={() => setSettingsDialogOpen(false)}
				title="Cấu hình máy chủ"
				description="Trạng thái provider server-side và khóa vận hành hiện có."
				size="wide"
			>
				<ProviderStatus availability={providerAvailability ?? undefined} />
			</Dialog>
		</main>
	);
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
									"Phiên Tuturuuu không hợp lệ. Vui lòng đăng nhập lại để mở bảng điều khiển."}
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
							Duyệt quyền trong Tuturuuu
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
	routeIds: { draftId?: string; evidenceId?: string; scanId?: string },
) {
	switch (page) {
		case "sources":
			return <SourcesPage {...props} />;
		case "analysis":
			return <AnalysisPage {...props} />;
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

function createCustomReportKind() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return `custom-${crypto.randomUUID()}`;
	}

	return `custom-${Date.now()}`;
}
