"use client";

import {
	CheckCircle2,
	ClipboardCopy,
	Database,
	FileBarChart,
	LoaderCircle,
	LockKeyhole,
	RefreshCw,
	Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Dialog } from "@/components/dashboard/dialog-frame";
import { ExportActions } from "@/components/dashboard/export-actions";
import type {
	AnalysisView,
	DashboardScan,
	DraftShape,
	EvidenceView,
	ReportSpec,
} from "@/components/dashboard/types";
import { PrimaryButton } from "@/components/dashboard/ui-primitives";
import type { ReportAiOutput } from "@/lib/llm/schemas";

export function ReportDialog({
	analysis,
	draft,
	evidence,
	onClose,
	open,
	report,
	selectedScan,
}: {
	analysis: AnalysisView;
	draft: DraftShape | null;
	evidence: EvidenceView;
	onClose: () => void;
	open: boolean;
	report: ReportSpec | null;
	selectedScan?: DashboardScan;
}) {
	const [status, setStatus] = useState("");
	const [aiReport, setAiReport] = useState<ReportAiOutput | null>(null);
	const [depth, setDepth] = useState<"standard" | "deep">("deep");
	const [isGenerating, setIsGenerating] = useState(false);
	const fallbackText = useMemo(
		() =>
			report
				? buildReportText({ analysis, draft, evidence, report, selectedScan })
				: "",
		[analysis, draft, evidence, report, selectedScan],
	);
	const requestPayload = useMemo(() => {
		if (!report || !selectedScan || evidence.length === 0) return null;
		return {
			analysis: {
				claims: analysis.claims,
				riskFlags: analysis.riskFlags,
				riskLevel: analysis.riskLevel,
				sentiment: analysis.sentiment,
				stanceSummary: analysis.stanceSummary,
				summary: analysis.summary,
				topicClusters: analysis.topicClusters,
			},
			draftBody: draft?.body ?? null,
			evidence: evidence.slice(0, 60).map((item) => ({
				id: item.id,
				quote: item.quote?.slice(0, 20_000) ?? null,
				riskLevel: item.riskLevel ?? null,
				sourceLabel: item.sourceLabel ?? null,
				summary: item.summary?.slice(0, 12_000) ?? null,
			})),
			report: {
				description: report.description,
				sections: report.sections,
				title: report.title,
			},
			scan: {
				createdAt: selectedScan.createdAt,
				provider: selectedScan.provider,
				riskLevel: selectedScan.riskLevel,
				sourceLabel: selectedScan.sourceLabel,
				status: selectedScan.status,
				title: selectedScan.title,
			},
		};
	}, [analysis, draft?.body, evidence, report, selectedScan]);
	const reportText = useMemo(
		() => (aiReport ? formatAiReport(aiReport, selectedScan) : fallbackText),
		[aiReport, fallbackText, selectedScan],
	);

	const generateReport = useCallback(
		async (requestedDepth: "standard" | "deep", signal?: AbortSignal) => {
			if (!requestPayload) {
				setStatus("Cần chọn lượt quét có bằng chứng trước khi tạo báo cáo AI.");
				return;
			}
			setDepth(requestedDepth);
			setIsGenerating(true);
			setStatus(
				requestedDepth === "deep"
					? "AI đang đối chiếu bằng chứng và soạn báo cáo chuyên sâu…"
					: "AI đang soạn báo cáo đầy đủ…",
			);
			try {
				const response = await fetch("/api/reports/generate", {
					body: JSON.stringify({ ...requestPayload, depth: requestedDepth }),
					cache: "no-store",
					headers: { "Content-Type": "application/json" },
					method: "POST",
					signal,
				});
				const payload = await response.json().catch(() => null);
				if (!response.ok || !payload?.report) {
					throw new Error(payload?.error ?? "Không thể tạo báo cáo bằng AI.");
				}
				setAiReport(payload.report as ReportAiOutput);
				setStatus(
					"Báo cáo AI đã sẵn sàng. Hãy kiểm tra các giới hạn và nguồn trước khi sử dụng.",
				);
			} catch (error) {
				if (signal?.aborted) return;
				setStatus(
					error instanceof Error
						? `${error.message} Bản tổng hợp có cấu trúc vẫn có thể xem và xuất.`
						: "Không thể tạo báo cáo bằng AI. Bản tổng hợp có cấu trúc vẫn có thể xem và xuất.",
				);
			} finally {
				if (!signal?.aborted) setIsGenerating(false);
			}
		},
		[requestPayload],
	);

	useEffect(() => {
		if (!open || !requestPayload) return;
		const controller = new AbortController();
		setAiReport(null);
		void generateReport("deep", controller.signal);
		return () => controller.abort();
	}, [generateReport, open, requestPayload]);

	if (!report) return null;

	async function copyReport() {
		try {
			await navigator.clipboard.writeText(reportText);
			setStatus("Đã sao chép bản xem trước vào clipboard.");
		} catch {
			setStatus("Trình duyệt không cho phép sao chép tự động; có thể tải tệp thay thế.");
		}
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={`Xem trước báo cáo: ${report.title}`}
			description="Kiểm tra nội dung và dữ liệu đầu vào trước khi tải file. Không có nội dung nào được tự động đăng tải."
			size="full"
		>
			<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
				<article className="max-h-[68vh] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-5 sm:p-7">
					<div className="mb-5 flex flex-wrap items-center gap-2 border-b border-[var(--divider)] pb-4">
						<span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--accent-strong)]">
							<Sparkles size={12} /> {aiReport ? "Báo cáo do AI soạn" : "Bản tổng hợp dữ liệu"}
						</span>
						<span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--muted-strong)]">
							{depth === "deep" ? "Chuyên sâu" : "Tiêu chuẩn"}
						</span>
					</div>
					<div className="whitespace-pre-wrap text-justify text-[13px] leading-7 text-[var(--muted-strong)]">
						{isGenerating && !aiReport ? (
							<div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
								<LoaderCircle className="animate-spin text-[var(--accent)]" size={28} />
								<p className="max-w-md font-semibold">Đang đọc, đối chiếu và phát triển từng mục từ bằng chứng của lượt quét.</p>
							</div>
						) : reportText}
					</div>
				</article>
				<div className="space-y-3">
					<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
						<FileBarChart className="text-[var(--accent)]" size={20} />
						<p className="mt-3 text-[13px] font-bold text-[var(--foreground)]">
							{report.title}
						</p>
						<p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
							{report.description}
						</p>
					</div>
					<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
						<p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.02em] text-[var(--muted)]"><Database size={14} /> Dữ liệu được dùng</p>
						<div className="mt-2 space-y-2 text-[11px] font-semibold leading-4 text-[var(--muted-strong)]">
							<p className="flex items-start gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--success-strong)]" /> Lượt quét: {selectedScan?.title ?? "chưa chọn"}</p>
							<p className="flex items-start gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--success-strong)]" /> {evidence.length} bằng chứng liên quan</p>
							<p className="flex items-start gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--success-strong)]" /> Bản nháp: {draft ? "đã có" : "chưa có"}</p>
						</div>
					</div>
					<div className="flex items-start gap-2 rounded-lg bg-[var(--accent-soft)] p-3 text-[11px] font-semibold leading-4 text-[var(--accent-strong)]">
						<LockKeyhole size={14} className="mt-0.5 shrink-0" />
						<span>Tải file chỉ lưu về thiết bị của bạn; không xuất bản lên Zalo OA hoặc mạng xã hội.</span>
					</div>
					<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
						<p className="text-[11px] font-bold text-[var(--foreground)]">Mức độ phân tích</p>
						<div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Mức độ phân tích báo cáo">
							{([['standard', 'Tiêu chuẩn'], ['deep', 'Chuyên sâu']] as const).map(([value, label]) => (
								<button
									aria-pressed={depth === value}
									className={`h-9 rounded-md border px-2 text-[11px] font-bold transition ${depth === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border)] text-[var(--muted-strong)]"}`}
									disabled={isGenerating}
									key={value}
									onClick={() => void generateReport(value)}
									type="button"
								>
									{label}
								</button>
							))}
						</div>
						<button
							type="button"
							disabled={isGenerating || !requestPayload}
							onClick={() => void generateReport(depth)}
							className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] text-[11px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:opacity-55"
						>
							{isGenerating ? <LoaderCircle className="animate-spin" size={14} /> : <RefreshCw size={14} />}
							Tạo lại báo cáo
						</button>
					</div>
					<PrimaryButton onClick={copyReport}>
						<ClipboardCopy size={15} /> Sao chép
					</PrimaryButton>
					<ExportActions
						compact
						content={reportText}
						fileName={`${report.kind}-cybershield35-report`}
						title={`CyberShield35 - ${report.title}`}
					/>
					{status ? (
						<p aria-live="polite" className="rounded-md bg-[var(--success-soft)] p-3 text-[11px] font-semibold leading-5 text-[var(--success-strong)]">
							{status}
						</p>
					) : null}
				</div>
			</div>
		</Dialog>
	);
}

function formatAiReport(report: ReportAiOutput, selectedScan?: DashboardScan) {
	const lines = [
		report.title,
		selectedScan ? `Lượt quét: ${selectedScan.title}` : "",
		"",
		"TÓM TẮT ĐIỀU HÀNH",
		report.executiveSummary,
		"",
		"PHÁT HIỆN CHÍNH",
		...report.keyFindings.map((finding, index) => `${index + 1}. ${finding}`),
		"",
	];
	for (const section of report.sections) {
		lines.push(section.heading.toLocaleUpperCase("vi-VN"), section.content);
		if (section.evidenceIds.length) {
			lines.push(`Bằng chứng liên quan: ${section.evidenceIds.join(", ")}`);
		}
		lines.push("");
	}
	if (report.recommendations.length) {
		lines.push(
			"KHUYẾN NGHỊ ƯU TIÊN",
			...report.recommendations.map((item, index) => `${index + 1}. ${item}`),
			"",
		);
	}
	if (report.limitations.length) {
		lines.push(
			"GIỚI HẠN VÀ ĐIỂM CẦN KIỂM CHỨNG",
			...report.limitations.map((item) => `• ${item}`),
			"",
		);
	}
	if (report.reviewNotes.length) {
		lines.push(
			"LƯU Ý BIÊN TẬP",
			...report.reviewNotes.map((item) => `• ${item}`),
		);
	}
	return lines.filter((line, index) => line || lines[index - 1] !== "").join("\n");
}

function buildReportText({
	analysis,
	draft,
	evidence,
	report,
	selectedScan,
}: {
	analysis: AnalysisView;
	draft: DraftShape | null;
	evidence: EvidenceView;
	report: ReportSpec;
	selectedScan?: DashboardScan;
}) {
	const lines = [
		`CyberShield 35 - ${report.title}`,
		`Scan: ${selectedScan?.title ?? "Chưa chọn"}`,
		`Nguồn: ${selectedScan?.sourceLabel ?? "Nguồn công khai"}`,
		`Trạng thái: ${reportScanStatus(selectedScan?.status)}`,
		`Mức rủi ro: ${reportRiskLabel(analysis.riskLevel)}`,
		"",
		"Tóm tắt phân tích",
		analysis.summary,
		`Lập trường: ${analysis.stanceSummary}`,
		"",
		"Các phần trong báo cáo",
		...report.sections.map((section, index) => `${index + 1}. ${section}`),
		"",
		"Bằng chứng nổi bật",
		...evidence.slice(0, 5).map((item, index) => {
			return `${index + 1}. [${item.riskLevel ?? "medium"}] ${item.quote ?? "Không có trích dẫn"} (${item.sourceLabel ?? "Nguồn công khai"})`;
		}),
		"",
		"Bản nháp phản hồi liên quan",
		draft?.body ?? "Chưa có bản nháp live cho scan đang chọn.",
		"",
		"Ràng buộc",
		"- Báo cáo phục vụ trao đổi nội bộ.",
		"- Không tự động đăng tải hoặc xuất bản.",
		"- Không ghi, nhập hoặc xuất provider key từ trình duyệt.",
	];

	return lines.join("\n");
}

function reportScanStatus(status?: DashboardScan["status"]) {
	if (status === "completed") return "Hoàn tất";
	if (status === "failed") return "Thất bại";
	if (status === "running") return "Đang xử lý";
	if (status === "retrying") return "Đang thử lại";
	if (status === "queued") return "Đang chờ";
	return "Chưa có dữ liệu";
}

function reportRiskLabel(risk: string) {
	if (risk === "high") return "Cao";
	if (risk === "medium") return "Trung bình";
	if (risk === "low") return "Thấp";
	return risk;
}
