"use client";

import { useEffect, useMemo, useState } from "react";

import {
	AuthDialog,
	CounterArgumentDialog,
	ScanDialog,
} from "@/components/dashboard/dialogs";
import {
	createScan,
	generateDraft,
	logout,
	onSessionVerified,
	refreshSession,
	reviewDraft,
} from "@/components/dashboard/client-actions";
import { composerOptions, type SourceTab } from "@/components/dashboard/dashboard-data";
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
	OverviewPage,
	ReportsPage,
	SettingsPage,
	SourcesPage,
	type DashboardPageProps,
} from "@/components/dashboard/dashboard-pages";
import { Sidebar, TopBar } from "@/components/dashboard/shell";
import type {
	AuthViewState,
	DashboardPage,
	DraftShape,
	ScanDetail,
	TopicCluster,
} from "@/components/dashboard/types";
import {
	demoAnalysis,
	demoDraft,
	demoEvidence,
	demoScans,
	type DashboardScan,
} from "@/lib/domain/fixtures";

export function CyberShieldDashboard({
	draftId,
	evidenceId,
	page = "overview",
	scanId,
}: {
	draftId?: string;
	evidenceId?: string;
	page?: DashboardPage;
	scanId?: string;
}) {
	const [inputMode, setInputMode] = useState<SourceTab>("url");
	const [urlInput, setUrlInput] = useState("https://facebook.com/example/posts/1");
	const [manualText, setManualText] = useState("");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [operatorNotes, setOperatorNotes] = useState("");
	const [scans, setScans] = useState<DashboardScan[]>(demoScans);
	const [selectedScanId, setSelectedScanId] = useState(
		scanId ?? demoScans[0]?.id ?? "demo-scan-1",
	);
	const [detail, setDetail] = useState<ScanDetail | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [isDrafting, setIsDrafting] = useState(false);
	const [notice, setNotice] = useState(
		"Chế độ hybrid: dùng dữ liệu mẫu khi thiếu khóa nhà cung cấp.",
	);
	const [auth, setAuth] = useState<AuthViewState>({ authenticated: false });
	const [draft, setDraft] = useState<DraftShape>(demoDraft);
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
	const [authDialogOpen, setAuthDialogOpen] = useState(false);
	const [scanDialogOpen, setScanDialogOpen] = useState(false);
	const [draftDialogOpen, setDraftDialogOpen] = useState(false);
	const activeScanId = scanId ?? selectedScanId;

	const selectedScan = useMemo(
		() =>
			scans.find((scan) => scan.id === activeScanId) ??
			scans[0] ??
			demoScans[0],
		[activeScanId, scans],
	);
	const analysis = (detail?.analysis ?? demoAnalysis) as typeof demoAnalysis;
	const evidence = detail?.evidence?.length ? detail.evidence : demoEvidence;
	const topics = (analysis.topicClusters ?? demoAnalysis.topicClusters) as TopicCluster[];

	useEffect(() => {
		let alive = true;
		fetch("/api/admin/session", { cache: "no-store" })
			.then(async (response) => {
				const payload = await response.json();
				if (!alive) return;
				if (response.ok && payload.session) {
					setAuth({ authenticated: true, configured: true, session: payload.session });
					setNotice("Đã xác thực bằng Tuturuuu external app login.");
				} else {
					setAuth({
						authenticated: false,
						configured: payload.configured,
						demoBypass: payload.demoBypass,
						error: payload.error,
					});
				}
			})
			.catch(() =>
				setAuth({
					authenticated: false,
					error: "Không thể kiểm tra phiên Tuturuuu.",
				}),
			);

		fetch("/api/scans", { cache: "no-store" })
			.then((response) => response.json())
			.then((payload: { scans?: DashboardScan[]; mode?: string }) => {
				if (!alive || !payload.scans?.length) return;
				const firstScan = payload.scans[0];
				if (!firstScan) return;
				setScans(payload.scans);
				if (!scanId) setSelectedScanId(firstScan.id);
				setNotice(
					payload.mode === "live"
						? "Đang đọc hàng đợi từ Postgres."
						: "Local demo auth bypass đang bật; dữ liệu vẫn đọc từ Postgres khi có.",
				);
			})
			.catch(() => setNotice("Đang hiển thị dữ liệu mẫu vì API chưa sẵn sàng."));

		return () => {
			alive = false;
		};
	}, [scanId]);

	useEffect(() => {
		let alive = true;
		fetch(`/api/scans/${activeScanId}`, { cache: "no-store" })
			.then((response) => response.json())
			.then((payload: { detail?: ScanDetail }) => {
				if (!alive) return;
				setDetail(payload.detail ?? null);
				setDraft((payload.detail?.drafts?.[0] as DraftShape) ?? demoDraft);
			})
			.catch(() => setDetail(null));

		return () => {
			alive = false;
		};
	}, [activeScanId]);

	const pageProps: DashboardPageProps = {
		auth,
		scans,
		selectedScan,
		selectedScanId: activeScanId,
		detail,
		analysis,
		topics,
		evidence,
		draft,
		onSelectScan: setSelectedScanId,
		onOpenAuth: () => setAuthDialogOpen(true),
		onOpenScan: () => setScanDialogOpen(true),
		onOpenDraft: () => setDraftDialogOpen(true),
		onRefreshAuth: () => refreshSession(setAuth, setNotice),
		onLogout: () => logout(setAuth, setNotice),
		onReview: (status) => reviewDraft({ draft, status, setDraft, setNotice }),
	};

	return (
		<main className="min-h-screen bg-[var(--background)] text-slate-950">
			<div className="min-h-screen lg:pl-[248px]">
				<Sidebar />
				<section className="min-w-0 lg:h-screen lg:overflow-y-auto">
					<TopBar notice={notice} />
					<div className="flex-1 px-3 py-4 sm:px-5 lg:px-6 lg:py-6">
						{renderPage(page, pageProps, { draftId, evidenceId, scanId })}
					</div>
				</section>
			</div>
			<AuthDialog
				auth={auth}
				open={authDialogOpen}
				onClose={() => setAuthDialogOpen(false)}
				onVerified={(session) => onSessionVerified(session, setAuth, setNotice)}
			/>
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
				isCreating={isCreating}
				onCreate={() =>
					createScan({
						inputMode,
						urlInput,
						manualText,
						selectedFile,
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
			return <SettingsPage {...props} />;
		case "audit":
			return <AuditPage {...props} />;
		default:
			return <OverviewPage {...props} />;
	}
}
