"use client";

import {
	FileText,
	Link2,
	Play,
	Save,
	Sparkles,
	UploadCloud,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Dialog } from "@/components/dashboard/dialog-frame";
import {
	composerOptions,
	sourceTabs,
	type SourceTab,
} from "@/components/dashboard/dashboard-data";
import { SocialLogoGrid } from "@/components/dashboard/social-logo-grid";
import { FieldLabel, PrimaryButton } from "@/components/dashboard/ui-primitives";
import type {
	DashboardScan,
	EvidenceView,
	ReportSpec,
} from "@/components/dashboard/types";
import type { ScanProviderOverride } from "@/lib/domain/provider-override";
import { detectSource } from "@/lib/domain/source-detection";

export { SocialLogoGrid } from "@/components/dashboard/social-logo-grid";

export function ScanDialog(props: {
	open: boolean;
	onClose: () => void;
	inputMode: SourceTab;
	setInputMode: (mode: SourceTab) => void;
	urlInput: string;
	setUrlInput: (value: string) => void;
	manualText: string;
	setManualText: (value: string) => void;
	selectedFile: File | null;
	setSelectedFile: (file: File | null) => void;
	providerOverride?: ScanProviderOverride;
	setProviderOverride: (provider?: ScanProviderOverride) => void;
	isCreating: boolean;
	onCreate: () => Promise<boolean>;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const hasInput =
		props.inputMode === "url"
			? Boolean(props.urlInput.trim())
			: props.inputMode === "file"
				? Boolean(props.selectedFile)
				: Boolean(props.manualText.trim());
	const preview = useMemo(() => {
		if (props.inputMode === "file" && props.selectedFile) {
			return detectSource(props.selectedFile.name, {
				fileName: props.selectedFile.name,
				mimeType: props.selectedFile.type,
			});
		}
		if (props.inputMode === "text" && props.manualText.trim()) {
			return detectSource(props.manualText);
		}
		if (props.inputMode === "url" && props.urlInput.trim()) {
			return detectSource(props.urlInput);
		}
		return null;
	}, [
		props.inputMode,
		props.manualText,
		props.selectedFile,
		props.urlInput,
	]);
	const selectedProvider = props.providerOverride ?? preview?.provider ?? "Tự động";

	function selectInputMode(mode: SourceTab) {
		props.setInputMode(mode);
		if (mode !== "url") props.setProviderOverride(undefined);
	}

	async function createAndClose() {
		const created = await props.onCreate();
		if (created) props.onClose();
	}

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			title="Tạo lượt quét mới"
			description="Chọn loại nguồn, kiểm tra adapter được đề xuất rồi đưa scan vào hàng đợi xử lý."
			size="wide"
		>
			<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
				<div className="min-w-0 space-y-5">
					<div className="grid grid-cols-3 gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-soft)] p-1">
						{sourceTabs.map((tab) => (
							<button
								type="button"
								key={tab.id}
								onClick={() => selectInputMode(tab.id)}
								className={`h-10 rounded-[5px] text-[12px] font-bold transition ${
									props.inputMode === tab.id
										? "bg-[var(--surface)] text-[var(--brand)] shadow-sm"
										: "text-[var(--muted)] hover:text-[var(--foreground)]"
								}`}
							>
								{tab.label}
							</button>
						))}
					</div>

					{props.inputMode === "url" ? (
						<div className="space-y-4">
							<label className="block">
								<FieldLabel>Nhập URL hoặc liên kết</FieldLabel>
								<div className="mt-2 flex gap-2">
									<input
										value={props.urlInput}
										onChange={(event) => props.setUrlInput(event.target.value)}
										placeholder="https://facebook.com/page hoặc https://..."
										className="h-11 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
									/>
									<span className="grid size-11 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)]">
										<Link2 size={16} />
									</span>
								</div>
							</label>
							<SocialLogoGrid compact />
						</div>
					) : null}

					{props.inputMode === "file" ? (
						<div className="space-y-3">
							<div>
								<FieldLabel>Tải tệp lên</FieldLabel>
								<p className="mt-1 text-[12px] text-[var(--muted)]">
									TXT, CSV, PDF, DOCX và định dạng văn bản phổ biến.
								</p>
							</div>
							<button
								type="button"
								onClick={() => inputRef.current?.click()}
								className="flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-5 text-center text-[var(--muted-strong)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
							>
								<UploadCloud size={30} />
								<span className="text-[13px] font-semibold">
									{props.selectedFile
										? props.selectedFile.name
										: "Chọn tệp để đưa vào hàng đợi phân tích"}
								</span>
							</button>
							<input
								ref={inputRef}
								type="file"
								className="hidden"
								onChange={(event) =>
									props.setSelectedFile(event.target.files?.[0] ?? null)
								}
							/>
						</div>
					) : null}

					{props.inputMode === "text" ? (
						<label className="block">
							<FieldLabel>Nhập văn bản thủ công</FieldLabel>
							<textarea
								value={props.manualText}
								onChange={(event) => props.setManualText(event.target.value)}
								placeholder="Dán nội dung cần phân tích tại đây..."
								className="mt-2 min-h-52 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-[13px] leading-6 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
								maxLength={50000}
							/>
							<span className="mt-2 block text-right text-[11px] text-[var(--muted)]">
								{props.manualText.length.toLocaleString("vi-VN")} / 50.000
							</span>
						</label>
					) : null}
					<div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-[12px] font-semibold text-[var(--muted-strong)] sm:grid-cols-3">
						<StepHint value="1" label="Tạo scan" />
						<StepHint value="2" label="Xử lý queue" />
						<StepHint value="3" label="Bằng chứng" />
					</div>
				</div>
				<div className="space-y-3">
					<div>
						<p className="text-[13px] font-bold text-[var(--foreground)]">
							Adapter thu thập
						</p>
						<p className="mt-1 text-[11px] font-semibold leading-4 text-[var(--muted)]">
							CS35 sẽ tự chọn adapter theo nguồn. Chỉ ép Browser Use khi trang URL
							khó scrape.
						</p>
					</div>
					<div
						className="space-y-2"
						role="radiogroup"
						aria-label="Nhà cung cấp thu thập"
					>
						<ProviderChoiceButton
							active={!props.providerOverride}
							label="Tự động"
							badge="Mặc định"
							helper={autoProviderHelper(props.inputMode)}
							onClick={() => props.setProviderOverride(undefined)}
						/>
						<ProviderChoiceButton
							active={props.providerOverride === "browser_use"}
							disabled={props.inputMode !== "url"}
							label="Browser Use"
							badge="URL"
							helper="Điều khiển trình duyệt cloud cho trang động hoặc khó scrape."
							onClick={() => props.setProviderOverride("browser_use")}
						/>
					</div>
					<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
						<p className="text-[11px] font-bold uppercase tracking-[0.02em] text-[var(--muted)]">
							Xem trước
						</p>
						<div className="mt-2 space-y-1 text-[12px] font-semibold text-[var(--muted-strong)]">
							<p className="truncate">
								Loại nguồn:{" "}
								<span className="text-[var(--foreground)]">
									{preview ? sourceTypeLabel(preview.type) : "Chưa có dữ liệu"}
								</span>
							</p>
							<p className="truncate">
								Adapter:{" "}
								<span className="text-[var(--foreground)]">
									{providerLabel(String(selectedProvider))}
								</span>
							</p>
							<p className="truncate">
								Tên gợi ý:{" "}
								<span className="text-[var(--foreground)]">
									{preview?.label ?? "Sẽ tự tạo sau khi nhập nguồn"}
								</span>
							</p>
						</div>
					</div>
					<div className="grid gap-2">
						<PrimaryButton
							disabled={props.isCreating || !hasInput}
							onClick={createAndClose}
						>
							<Play size={16} />
							{props.isCreating ? "Đang đưa vào hàng đợi..." : "Tạo scan"}
						</PrimaryButton>
						<p className="text-[11px] font-semibold leading-4 text-[var(--muted)]">
							Scan mới sẽ ở trạng thái “Đang chờ” và được job xử lý hàng đợi chạy
							mỗi 30 phút, hoặc bạn có thể bấm xử lý ngay trong phần Tự động.
						</p>
					</div>
				</div>
			</div>
		</Dialog>
	);
}

function StepHint({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex min-w-0 items-center gap-2">
			<span className="grid size-6 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-[11px] font-black text-[var(--accent-strong)]">
				{value}
			</span>
			<span className="min-w-0 text-[11px] leading-4">{label}</span>
		</div>
	);
}

function ProviderChoiceButton({
	active,
	badge,
	disabled,
	helper,
	label,
	onClick,
}: {
	active: boolean;
	badge: string;
	disabled?: boolean;
	helper: string;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			role="radio"
			aria-checked={active}
			disabled={disabled}
			onClick={onClick}
			className={`w-full rounded-md border p-3 text-left transition ${
				active
					? "border-[var(--accent)] bg-[var(--accent-soft)]"
					: "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
			} ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
		>
			<div className="flex items-center justify-between gap-3">
				<p className="min-w-0 truncate text-[12px] font-bold text-[var(--foreground)]">
					{label}
				</p>
				<span className="inline-flex h-6 min-w-14 shrink-0 items-center justify-center rounded-md bg-[var(--surface)] px-2 text-center text-[10px] font-bold leading-none text-[var(--muted-strong)]">
					{badge}
				</span>
			</div>
			<p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">{helper}</p>
		</button>
	);
}

function autoProviderHelper(inputMode: SourceTab) {
	if (inputMode === "file")
		return "Tệp dùng parser tài liệu hoặc phân tích văn bản cục bộ.";
	if (inputMode === "text") return "Văn bản thủ công dùng phân tích cục bộ.";
	return "Facebook dùng Apify; website dùng Firecrawl theo nhận diện nguồn.";
}

function providerLabel(provider: string) {
	const labels: Record<string, string> = {
		apify_facebook_comments: "Apify Facebook comments",
		apify_facebook_groups: "Apify Facebook groups",
		apify_facebook_posts: "Apify Facebook posts",
		browser_use: "Browser Use",
		firecrawl: "Firecrawl",
		firecrawl_parse: "Firecrawl Parse",
		local_text: "Phân tích văn bản",
	};
	return labels[provider] ?? provider;
}

function sourceTypeLabel(type: string) {
	const labels: Record<string, string> = {
		facebook_group: "Facebook group",
		facebook_page: "Facebook page",
		facebook_post: "Facebook post",
		file: "Tệp",
		text: "Văn bản",
		url: "Website",
	};
	return labels[type] ?? type;
}

export function CounterArgumentDialog(props: {
	open: boolean;
	onClose: () => void;
	tone: string;
	setTone: (value: string) => void;
	audience: string;
	setAudience: (value: string) => void;
	language: string;
	setLanguage: (value: string) => void;
	length: string;
	setLength: (value: string) => void;
	operatorNotes: string;
	setOperatorNotes: (value: string) => void;
	isDrafting: boolean;
	onGenerate: () => Promise<boolean>;
}) {
	async function generateAndClose() {
		const generated = await props.onGenerate();
		if (generated) props.onClose();
	}

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			title="Tạo lập luận phản hồi"
			description="Bản nháp chỉ dùng bằng chứng đã lưu và luôn cần người vận hành duyệt."
			size="wide"
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<Select
					label="Tone / Giọng điệu"
					value={props.tone}
					onChange={props.setTone}
					options={composerOptions.tones}
				/>
				<Select
					label="Đối tượng"
					value={props.audience}
					onChange={props.setAudience}
					options={composerOptions.audiences}
				/>
				<Select
					label="Ngôn ngữ"
					value={props.language}
					onChange={props.setLanguage}
					options={composerOptions.languages}
				/>
				<Select
					label="Độ dài"
					value={props.length}
					onChange={props.setLength}
					options={composerOptions.lengths}
				/>
			</div>
			<label className="mt-4 flex items-center gap-2 rounded-md bg-[var(--success-soft)] p-3 text-[12px] font-semibold text-[var(--success-strong)]">
				<input type="checkbox" defaultChecked className="size-4 accent-[var(--brand)]" />
				Chỉ sử dụng bằng chứng đã xác minh (Evidence only)
			</label>
			<label className="mt-4 block">
				<FieldLabel>Ghi chú người vận hành</FieldLabel>
				<textarea
					value={props.operatorNotes}
					onChange={(event) => props.setOperatorNotes(event.target.value)}
					placeholder="Yêu cầu bổ sung về bối cảnh, giới hạn diễn đạt hoặc điểm cần tránh..."
					className="mt-2 min-h-28 w-full resize-none rounded-md border border-[var(--border)] p-3 text-[13px] leading-6 outline-none focus:border-[var(--accent)]"
				/>
			</label>
			<div className="mt-4">
				<PrimaryButton disabled={props.isDrafting} onClick={generateAndClose}>
					<Sparkles size={15} />
					{props.isDrafting ? "Đang tạo bản nháp" : "Generate counter-argument"}
				</PrimaryButton>
			</div>
		</Dialog>
	);
}

type ScanEditDialogProps = {
	onClose: () => void;
	onSave: (
		scan: DashboardScan,
		values: { status: DashboardScan["status"]; title: string },
	) => Promise<boolean>;
	open: boolean;
	scan: DashboardScan | null;
};

export function ScanEditDialog(props: ScanEditDialogProps) {
	if (!props.open) return null;
	return <ScanEditDialogContent {...props} />;
}

function ScanEditDialogContent({
	onClose,
	onSave,
	scan,
}: ScanEditDialogProps) {
	const [title, setTitle] = useState(scan?.title ?? "");
	const [status, setStatus] = useState<DashboardScan["status"]>(
		scan?.status ?? "queued",
	);

	async function saveAndClose() {
		if (!scan) return;
		const saved = await onSave(scan, { status, title: title.trim() });
		if (saved) onClose();
	}

	return (
		<Dialog
			open={true}
			onClose={onClose}
			title="Chỉnh scan"
			description="Cập nhật tên hiển thị và trạng thái vận hành."
		>
			<div className="space-y-4">
				<label className="block">
					<FieldLabel>Tên scan</FieldLabel>
					<input
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
						maxLength={240}
					/>
				</label>
				<label className="block">
					<FieldLabel>Trạng thái</FieldLabel>
					<select
						value={status}
						onChange={(event) =>
							setStatus(event.target.value as DashboardScan["status"])
						}
						className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
					>
						<option value="queued">Đang chờ</option>
						<option value="running">Đang quét</option>
						<option value="retrying">Thử lại</option>
						<option value="completed">Hoàn tất</option>
						<option value="failed">Lỗi</option>
					</select>
				</label>
				<PrimaryButton disabled={!scan || !title.trim()} onClick={saveAndClose}>
					<Save size={15} /> Lưu scan
				</PrimaryButton>
			</div>
		</Dialog>
	);
}

type EvidenceEditDialogProps = {
	evidence: EvidenceView[number] | null;
	onClose: () => void;
	onSubmit: (
		values: EvidenceFormValues,
		evidence: EvidenceView[number] | null,
	) => Promise<boolean>;
	open: boolean;
	scanId: string;
};

export function EvidenceEditDialog(props: EvidenceEditDialogProps) {
	if (!props.open) return null;
	return <EvidenceEditDialogContent {...props} />;
}

function EvidenceEditDialogContent({
	evidence,
	onClose,
	onSubmit,
	scanId,
}: EvidenceEditDialogProps) {
	const [values, setValues] = useState<EvidenceFormValues>(
		evidenceValuesFromItem(evidence),
	);

	async function submitAndClose() {
		const saved = await onSubmit(values, evidence);
		if (saved) onClose();
	}

	return (
		<Dialog
			open={true}
			onClose={onClose}
			title={evidence ? "Chỉnh bằng chứng" : "Thêm bằng chứng"}
			description="Bằng chứng được gắn với scan đang chọn."
			size="wide"
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className="block sm:col-span-2">
					<FieldLabel>Trích dẫn</FieldLabel>
					<textarea
						value={values.quote}
						onChange={(event) =>
							setValues((current) => ({
								...current,
								quote: event.target.value,
							}))
						}
						className="mt-2 min-h-28 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-[13px] leading-6 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
						maxLength={4000}
					/>
				</label>
				<label className="block sm:col-span-2">
					<FieldLabel>Tóm tắt</FieldLabel>
					<textarea
						value={values.summary}
						onChange={(event) =>
							setValues((current) => ({
								...current,
								summary: event.target.value,
							}))
						}
						className="mt-2 min-h-24 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-[13px] leading-6 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
						maxLength={4000}
					/>
				</label>
				<label className="block">
					<FieldLabel>Nguồn</FieldLabel>
					<input
						value={values.sourceLabel}
						onChange={(event) =>
							setValues((current) => ({
								...current,
								sourceLabel: event.target.value,
							}))
						}
						className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
						maxLength={240}
					/>
				</label>
				<label className="block">
					<FieldLabel>Tác giả</FieldLabel>
					<input
						value={values.author}
						onChange={(event) =>
							setValues((current) => ({
								...current,
								author: event.target.value,
							}))
						}
						className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
						maxLength={160}
					/>
				</label>
				<label className="block">
					<FieldLabel>Liên kết nguồn</FieldLabel>
					<input
						value={values.sourceUrl}
						onChange={(event) =>
							setValues((current) => ({
								...current,
								sourceUrl: event.target.value,
							}))
						}
						className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
						placeholder="https://..."
					/>
				</label>
				<label className="block">
					<FieldLabel>Rủi ro</FieldLabel>
					<select
						value={values.riskLevel}
						onChange={(event) =>
							setValues((current) => ({
								...current,
								riskLevel: event.target.value as EvidenceFormValues["riskLevel"],
							}))
						}
						className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
					>
						<option value="low">Thấp</option>
						<option value="medium">Trung bình</option>
						<option value="high">Cao</option>
					</select>
				</label>
			</div>
			<div className="mt-4">
				<PrimaryButton
					disabled={!scanId || !values.quote.trim() || !values.summary.trim()}
					onClick={submitAndClose}
				>
					<Save size={15} /> Lưu bằng chứng
				</PrimaryButton>
			</div>
		</Dialog>
	);
}

type ReportPresetDialogProps = {
	onClose: () => void;
	onSubmit: (
		values: { description: string; sections: string[]; title: string },
		report: ReportSpec | null,
	) => void;
	open: boolean;
	report: ReportSpec | null;
};

export function ReportPresetDialog(props: ReportPresetDialogProps) {
	if (!props.open) return null;
	return <ReportPresetDialogContent {...props} />;
}

function ReportPresetDialogContent({
	onClose,
	onSubmit,
	report,
}: ReportPresetDialogProps) {
	const [title, setTitle] = useState(report?.title ?? "");
	const [description, setDescription] = useState(report?.description ?? "");
	const [sections, setSections] = useState(report?.sections.join("\n") ?? "");

	function submitAndClose() {
		const normalizedSections = sections
			.split("\n")
			.map((section) => section.trim())
			.filter(Boolean);
		if (!title.trim() || !description.trim() || !normalizedSections.length) return;

		onSubmit(
			{
				description: description.trim(),
				sections: normalizedSections,
				title: title.trim(),
			},
			report,
		);
		onClose();
	}

	return (
		<Dialog
			open={true}
			onClose={onClose}
			title={report ? "Chỉnh preset báo cáo" : "Tạo preset báo cáo"}
			description="Preset quyết định cấu trúc bản xem trước xuất từ dữ liệu đang chọn."
			size="wide"
		>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
				<div className="space-y-4">
					<label className="block">
						<FieldLabel>Tên báo cáo</FieldLabel>
						<input
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
						/>
					</label>
					<label className="block">
						<FieldLabel>Mô tả</FieldLabel>
						<textarea
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							className="mt-2 min-h-24 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-[13px] leading-6 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
						/>
					</label>
					<label className="block">
						<FieldLabel>Các phần</FieldLabel>
						<textarea
							value={sections}
							onChange={(event) => setSections(event.target.value)}
							className="mt-2 min-h-36 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-[13px] leading-6 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
						/>
					</label>
				</div>
				<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
					<FileText className="text-[var(--accent)]" size={22} />
					<p className="mt-3 text-[13px] font-bold text-[var(--foreground)]">
						{title.trim() || "Preset báo cáo"}
					</p>
					<p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
						{description.trim() || "Mô tả sẽ hiển thị trong thẻ báo cáo."}
					</p>
				</div>
			</div>
			<div className="mt-4">
				<PrimaryButton
					disabled={
						!title.trim() ||
						!description.trim() ||
						!sections
							.split("\n")
							.some((section) => Boolean(section.trim()))
					}
					onClick={submitAndClose}
				>
					<Save size={15} /> Lưu preset
				</PrimaryButton>
			</div>
		</Dialog>
	);
}

export type EvidenceFormValues = {
	author: string;
	quote: string;
	riskLevel: "low" | "medium" | "high";
	sourceLabel: string;
	sourceUrl: string;
	summary: string;
};

const emptyEvidenceValues: EvidenceFormValues = {
	author: "",
	quote: "",
	riskLevel: "medium",
	sourceLabel: "",
	sourceUrl: "",
	summary: "",
};

function evidenceValuesFromItem(
	evidence: EvidenceView[number] | null,
): EvidenceFormValues {
	if (!evidence) return emptyEvidenceValues;

	return {
		author: stringValue(evidence.author),
		quote: stringValue(evidence.quote),
		riskLevel: evidence.riskLevel ?? "medium",
		sourceLabel: stringValue(evidence.sourceLabel),
		sourceUrl: stringValue(evidence.sourceUrl),
		summary: stringValue(evidence.summary),
	};
}

function stringValue(value: unknown) {
	return typeof value === "string" ? value : "";
}

function Select(props: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: string[];
}) {
	return (
		<label className="min-w-0 text-[12px] font-bold text-[var(--muted-strong)]">
			{props.label}
			<select
				value={props.value}
				onChange={(event) => props.onChange(event.target.value)}
				className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
			>
				{props.options.map((option) => (
					<option key={option}>{option}</option>
				))}
			</select>
		</label>
	);
}
