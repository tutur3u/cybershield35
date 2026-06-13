import type { ReactNode } from "react";

import type { RiskLevel, ScanStatus } from "@/lib/db/schema";

export function Panel({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<section
			className={`rounded-lg border border-[var(--border)] bg-white shadow-[var(--shadow-soft)] ${className}`}
		>
			{children}
		</section>
	);
}

export function PanelHeader({
	title,
	description,
	action,
}: {
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex min-w-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
			<div className="min-w-0">
				<h2 className="truncate text-[15px] font-bold text-slate-950">{title}</h2>
				{description ? (
					<p className="mt-1 text-[12px] leading-5 text-slate-500">{description}</p>
				) : null}
			</div>
			{action}
		</div>
	);
}

export function StatusPill({ status }: { status: ScanStatus | string }) {
	const styles: Record<string, string> = {
		queued: "bg-slate-100 text-slate-600",
		running: "bg-blue-50 text-blue-700",
		completed: "bg-green-50 text-green-700",
		failed: "bg-red-50 text-red-700",
		retrying: "bg-amber-50 text-amber-700",
	};
	const labels: Record<string, string> = {
		queued: "Đang chờ",
		running: "Đang quét",
		completed: "Hoàn tất",
		failed: "Lỗi",
		retrying: "Thử lại",
	};

	return (
		<span
			className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-bold ${styles[status] ?? styles.queued}`}
		>
			{labels[status] ?? status}
		</span>
	);
}

export function RiskPill({ risk }: { risk: RiskLevel | string }) {
	const styles: Record<string, string> = {
		high: "bg-red-50 text-red-700",
		medium: "bg-amber-50 text-amber-700",
		low: "bg-green-50 text-green-700",
	};
	const labels: Record<string, string> = {
		high: "Cao",
		medium: "Trung bình",
		low: "Thấp",
	};

	return (
		<span
			className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-bold ${styles[risk] ?? styles.medium}`}
		>
			{labels[risk] ?? risk}
		</span>
	);
}

export function ProgressBar({ value }: { value: number }) {
	return (
		<div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
			<div
				className="h-full rounded-full bg-[var(--accent)] transition-all"
				style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
			/>
		</div>
	);
}

export function FieldLabel({ children }: { children: ReactNode }) {
	return (
		<label className="text-[12px] font-bold uppercase tracking-[0.02em] text-slate-600">
			{children}
		</label>
	);
}

export function PrimaryButton({
	children,
	disabled,
	type = "button",
	onClick,
}: {
	children: ReactNode;
	disabled?: boolean;
	type?: "button" | "submit";
	onClick?: () => void | Promise<void>;
}) {
	return (
		<button
			type={type}
			disabled={disabled}
			onClick={onClick}
			className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[13px] font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
		>
			{children}
		</button>
	);
}

export function SecondaryButton({
	children,
	onClick,
}: {
	children: ReactNode;
	onClick?: () => void | Promise<void>;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-[12px] font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
		>
			{children}
		</button>
	);
}
