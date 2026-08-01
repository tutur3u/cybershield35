"use client";

import { CheckCircle2, ClipboardCopy, Database, FileBarChart, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";

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

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={`Xem trước báo cáo: ${report.title}`}
			description="Kiểm tra nội dung và dữ liệu đầu vào trước khi tải file. Không có nội dung nào được tự động đăng tải."
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
