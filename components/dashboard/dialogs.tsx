"use client";

import {
	KeyRound,
	Link2,
	Play,
	ShieldCheck,
	Sparkles,
	UploadCloud,
} from "lucide-react";
import { useRef, useState } from "react";

import { Dialog } from "@/components/dashboard/dialog-frame";
import {
	composerOptions,
	providerRows,
	sourceTabs,
	type SourceTab,
} from "@/components/dashboard/dashboard-data";
import { SocialLogoGrid } from "@/components/dashboard/social-logo-grid";
import type { AdminSessionView, AuthViewState } from "@/components/dashboard/types";
import { FieldLabel, PrimaryButton } from "@/components/dashboard/ui-primitives";

export { SocialLogoGrid } from "@/components/dashboard/social-logo-grid";

export function AuthDialog({
	auth,
	open,
	onClose,
	onVerified,
}: {
	auth: AuthViewState;
	open: boolean;
	onClose: () => void;
	onVerified: (session: AdminSessionView) => void;
}) {
	const [token, setToken] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function verifyToken() {
		setSubmitting(true);
		setError(null);
		try {
			const response = await fetch("/api/auth/verify-app-token", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token }),
			});
			const payload = await response.json();
			if (!response.ok) throw new Error(payload.error ?? "Không thể xác thực");
			onVerified(payload.session);
			setToken("");
			onClose();
		} catch (requestError) {
			setError(
				requestError instanceof Error
					? requestError.message
					: "Không thể xác thực Tuturuuu",
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Xác thực Tuturuuu"
			description={
				auth.demoBypass
					? "Local demo bypass đang bật; token thật chỉ cần khi kiểm thử server riêng."
					: "Dán short app token do Tuturuuu external app cấp cho phiên quản trị."
			}
		>
			<div className="space-y-4">
				<label className="block text-[12px] font-bold text-[var(--muted-strong)]">
					Short app token
					<div className="mt-2 flex gap-2">
						<input
							value={token}
							onChange={(event) => setToken(event.target.value)}
							placeholder="Dán token tại đây"
							type="password"
							className="h-11 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
						/>
						<span className="grid size-11 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)]">
							<KeyRound size={16} />
						</span>
					</div>
				</label>
				{error || auth.error ? (
					<p className="rounded-md bg-[var(--danger-soft)] p-3 text-[12px] font-semibold text-[var(--danger-strong)]">
						{error ?? auth.error}
					</p>
				) : null}
				<PrimaryButton disabled={submitting || !token.trim()} onClick={verifyToken}>
					<ShieldCheck size={15} />
					{submitting ? "Đang xác thực" : "Xác thực Tuturuuu"}
				</PrimaryButton>
			</div>
		</Dialog>
	);
}

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
	isCreating: boolean;
	onCreate: () => Promise<boolean>;
}) {
	const inputRef = useRef<HTMLInputElement>(null);

	async function createAndClose() {
		const created = await props.onCreate();
		if (created) props.onClose();
	}

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			title="Tạo lượt quét mới"
			description="Nhập URL, tải tệp, hoặc dán văn bản để hệ thống tự chọn adapter phù hợp."
			size="wide"
		>
			<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
				<div className="min-w-0 space-y-5">
					<div className="grid grid-cols-3 gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-soft)] p-1">
						{sourceTabs.map((tab) => (
							<button
								type="button"
								key={tab.id}
								onClick={() => props.setInputMode(tab.id)}
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
										placeholder="https://facebook.com/example hoặc https://..."
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
				</div>
				<div className="space-y-3">
					<p className="text-[13px] font-bold text-[var(--foreground)]">
						Nhà cung cấp thu thập
					</p>
					{providerRows.map((provider) => (
						<div
							key={provider.label}
							className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3"
						>
							<div className="flex items-center justify-between gap-3">
								<p className="min-w-0 truncate text-[12px] font-bold text-[var(--foreground)]">
									{provider.label}
								</p>
								<span className="inline-flex h-6 min-w-14 shrink-0 items-center justify-center rounded-md bg-[var(--success-soft)] px-2 text-center text-[10px] font-bold leading-none text-[var(--success-strong)]">
									Hybrid
								</span>
							</div>
							<p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
								{provider.helper}
							</p>
						</div>
					))}
					<PrimaryButton disabled={props.isCreating} onClick={createAndClose}>
						<Play size={16} />
						{props.isCreating ? "Đang tạo scan" : "Run scan"}
					</PrimaryButton>
				</div>
			</div>
		</Dialog>
	);
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
