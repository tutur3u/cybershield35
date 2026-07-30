"use client";

import {
	FileText,
	Headphones,
	LoaderCircle,
	type LucideIcon,
} from "lucide-react";
import { useState } from "react";

type ExportFormat = "docx" | "pdf" | "wav";

const exportOptions: Array<{
	format: ExportFormat;
	icon: LucideIcon;
	label: string;
}> = [
	{ format: "docx", icon: FileText, label: "Word" },
	{ format: "pdf", icon: FileText, label: "PDF" },
	{ format: "wav", icon: Headphones, label: "Âm thanh" },
];

export function ExportActions({
	compact = false,
	content,
	fileName,
	title,
}: {
	compact?: boolean;
	content: string;
	fileName: string;
	title: string;
}) {
	const [pending, setPending] = useState<ExportFormat | null>(null);
	const [status, setStatus] = useState("");
	const disabled = !content.trim();
	const exportFileName = normalizeExportFileName(fileName);

	async function download(format: ExportFormat) {
		if (pending || disabled) return;
		setPending(format);
		setStatus(
			format === "wav"
				? "Google Gemini đang tạo bản đọc tiếng Việt…"
				: "Đang chuẩn bị tệp tải xuống…",
		);

		try {
			const response = await fetch("/api/exports", {
				body: JSON.stringify({
					content,
					fileName: exportFileName,
					format,
					title,
				}),
				cache: "no-store",
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			if (!response.ok) {
				const payload = await response.json().catch(() => null);
				throw new Error(payload?.error ?? "Không thể tạo tệp xuất.");
			}

			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `${exportFileName}.${format}`;
			document.body.append(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
			setStatus(
				format === "wav"
					? "Đã tải bản đọc tiếng Việt xuống thiết bị."
					: `Đã tải tệp ${format.toUpperCase()} xuống thiết bị.`,
			);
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Không thể tạo tệp xuất.",
			);
		} finally {
			setPending(null);
		}
	}

	return (
		<div className="space-y-2">
			<div className={compact ? "grid gap-2" : "grid grid-cols-3 gap-2"}>
				{exportOptions.map(({ format, icon: Icon, label }) => (
					<button
						key={format}
						type="button"
						disabled={disabled || pending !== null}
						onClick={() => void download(format)}
						className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[11px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-55"
					>
						{pending === format ? (
							<LoaderCircle className="shrink-0 animate-spin" size={14} />
						) : (
							<Icon className="shrink-0" size={14} />
						)}
						<span className="truncate">{label}</span>
					</button>
				))}
			</div>
			{status ? (
				<p
					aria-live="polite"
					className="rounded-md bg-[var(--surface-soft)] px-3 py-2 text-[11px] font-semibold leading-5 text-[var(--muted-strong)]"
				>
					{status}
				</p>
			) : null}
		</div>
	);
}

export function normalizeExportFileName(value: string) {
	return value.trim().slice(0, 120) || "cybershield35-export";
}
