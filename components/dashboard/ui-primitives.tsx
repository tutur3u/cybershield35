import type { ReactNode } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@tuturuuu/ui/tooltip";

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
			className={`min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] ${className}`}
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
				<h2 className="text-[15px] font-bold leading-6 text-[var(--foreground)]">
					{title}
				</h2>
				{description ? (
					<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
						{description}
					</p>
				) : null}
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
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
	const help: Record<string, string> = {
		queued: "Scan đã được tạo và đang chờ worker xử lý.",
		running: "Worker đang thu thập hoặc phân tích dữ liệu cho scan này.",
		completed: "Scan đã xử lý xong và có thể đọc bằng chứng, chủ đề, cảnh báo.",
		failed: "Scan gặp lỗi. Mở chi tiết hoặc nhật ký để xem bước bị chặn.",
		retrying: "Hệ thống đang thử chạy lại sau một lỗi tạm thời.",
	};

	return (
		<DashboardTooltip content={help[status] ?? "Trạng thái hiện tại của scan."}>
			<span
				className={`inline-flex h-6 min-w-[72px] max-w-full shrink-0 items-center justify-center rounded-md px-2.5 text-center text-[11px] font-bold leading-none shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)] whitespace-nowrap ${styles[status] ?? styles.queued}`}
			>
				{labels[status] ?? status}
			</span>
		</DashboardTooltip>
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
	const help: Record<string, string> = {
		high: "Rủi ro cao: cần đọc bằng chứng và ưu tiên xử lý trước khi dùng báo cáo.",
		medium: "Rủi ro trung bình: có tín hiệu cần kiểm tra cùng bằng chứng liên quan.",
		low: "Rủi ro thấp: chưa thấy tín hiệu nghiêm trọng trong dữ liệu hiện tại.",
	};

	return (
		<DashboardTooltip content={help[risk] ?? "Mức rủi ro do phân tích gán cho mục này."}>
			<span
				className={`inline-flex h-6 min-w-12 max-w-full shrink-0 items-center justify-center rounded-md px-2.5 text-center text-[11px] font-bold leading-none shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)] whitespace-nowrap ${styles[risk] ?? styles.medium}`}
			>
				{labels[risk] ?? risk}
			</span>
		</DashboardTooltip>
	);
}

export function DashboardTooltip({
	children,
	content,
}: {
	children: ReactNode;
	content: ReactNode;
}) {
	return (
		<TooltipProvider delayDuration={120}>
			<Tooltip>
				<TooltipTrigger asChild>{children}</TooltipTrigger>
				<TooltipContent
					sideOffset={8}
					className="max-w-[280px] rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[11px] font-semibold leading-4 text-[var(--foreground)] shadow-[0_12px_30px_rgb(0_0_0/0.22)]"
				>
					{content}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function ProgressBar({ value }: { value: number }) {
	return (
		<div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--neutral-soft)]">
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
			className="inline-flex h-11 max-w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[13px] font-bold text-white shadow-sm transition whitespace-nowrap hover:bg-[var(--accent-strong)] disabled:opacity-60"
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
			className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
		>
			{children}
		</button>
	);
}
