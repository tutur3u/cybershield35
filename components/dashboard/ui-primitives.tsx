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
			className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] ${className}`}
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
				<h2 className="truncate text-[15px] font-bold text-[var(--foreground)]">
					{title}
				</h2>
				{description ? (
					<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
						{description}
					</p>
				) : null}
			</div>
			{action}
		</div>
	);
}

export function StatusPill({ status }: { status: ScanStatus | string }) {
	const styles: Record<string, string> = {
		queued: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]",
		running: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
		completed: "bg-[var(--success-soft)] text-[var(--success-strong)]",
		failed: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
		retrying: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
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
		high: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
		medium: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
		low: "bg-[var(--success-soft)] text-[var(--success-strong)]",
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
		<div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
			<div
				className="h-full rounded-full bg-[var(--accent)] transition-all"
				style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
			/>
		</div>
	);
}

export function FieldLabel({ children }: { children: ReactNode }) {
	return (
		<label className="text-[12px] font-bold uppercase tracking-[0.02em] text-[var(--muted-strong)]">
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
			className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[13px] font-bold text-white shadow-sm transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
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
			className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
		>
			{children}
		</button>
	);
}
