"use client";

import { ClipboardCopy, Download, FileBarChart } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog } from "@/components/dashboard/dialog-frame";
import type {
	AnalysisView,
	DashboardScan,
	DraftShape,
	EvidenceView,
	ReportSpec,
} from "@/components/dashboard/types";
import { PrimaryButton, SecondaryButton } from "@/components/dashboard/ui-primitives";

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
	const reportText = useMemo(
		() =>
			report
				? buildReportText({ analysis, draft, evidence, report, selectedScan })
				: "",
		[analysis, draft, evidence, report, selectedScan],
	);

	if (!report) return null;

	async function copyReport() {
		try {
			await navigator.clipboard.writeText(reportText);
			setStatus("Đã sao chép bản xem trước vào clipboard.");
		} catch {
			setStatus("Trình duyệt không cho phép sao chép tự động; có thể tải tệp thay thế.");
		}
	}

	function downloadReport() {
		if (!report) return;
		const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `${report.kind}-cybershield35-report.txt`;
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
		setStatus("Đã tạo tệp báo cáo .txt trong trình duyệt.");
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={`Chuẩn bị báo cáo: ${report.title}`}
			description="Bản xem trước chỉ dùng dữ liệu đang hiển thị trong dashboard và không tự động xuất bản."
			size="wide"
		>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
				<pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-[12px] leading-6 text-[var(--muted-strong)]">
					{reportText}
				</pre>
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
					<PrimaryButton onClick={copyReport}>
						<ClipboardCopy size={15} /> Sao chép
					</PrimaryButton>
					<SecondaryButton onClick={downloadReport}>
						<Download size={14} /> Tải .txt
					</SecondaryButton>
					{status ? (
						<p className="rounded-md bg-[var(--success-soft)] p-3 text-[12px] font-semibold text-[var(--success-strong)]">
							{status}
						</p>
					) : null}
				</div>
			</div>
		</Dialog>
	);
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
		`Trạng thái: ${selectedScan?.status ?? "chưa có scan live"}`,
		`Mức rủi ro: ${analysis.riskLevel}`,
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
		"- Không ghi hoặc xuất khóa kiểm thử từ phiên trình duyệt.",
	];

	return lines.join("\n");
}
