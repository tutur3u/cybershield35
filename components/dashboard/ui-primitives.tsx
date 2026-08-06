import {
	AlertTriangle,
	Bell,
	CheckCircle2,
	Clock,
	Loader,
	PencilLine,
	RotateCcw,
	ShieldAlert,
	ShieldCheck,
	XCircle,
	type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@tuturuuu/ui/tooltip";

import type { RiskExplanation } from "@/lib/domain/risk-explanation";
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
			className={`min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] [contain-intrinsic-size:auto_320px] [content-visibility:auto] ${className}`}
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

export function StatusPill({
	detail,
	status,
}: {
	/**
	 * The actual reason this scan stopped. Shown in place of the generic help
	 * text, because "a temporary error" is exactly the wrong thing to tell
	 * someone whose provider account has run out of quota.
	 */
	detail?: string | null;
	status: ScanStatus | string;
}) {
	const config: Record<
		string,
		{ className: string; help: string; icon: LucideIcon; label: string }
	> = {
		completed: {
			className: "bg-[var(--success-soft)] text-[var(--success-strong)]",
			help: "Lượt quét đã xong; nội dung và phân tích đã sẵn sàng.",
			icon: CheckCircle2,
			label: "Hoàn tất",
		},
		failed: {
			className: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
			help: "Lượt quét gặp lỗi. Mở chi tiết để xem bước bị chặn.",
			icon: XCircle,
			label: "Lỗi",
		},
		queued: {
			className: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]",
			help: "Đã đưa vào hàng đợi và đang chờ tới lượt xử lý.",
			icon: Clock,
			label: "Đang chờ",
		},
		retrying: {
			className: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
			help: "Hệ thống đang thử lại sau một lỗi tạm thời.",
			icon: RotateCcw,
			label: "Thử lại",
		},
		running: {
			className: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
			help: "Đang thu thập và phân tích nội dung.",
			icon: Loader,
			label: "Đang quét",
		},
	};
	const entry = config[status] ?? config.queued!;
	const Icon = entry.icon;
	const help = detail?.trim() || entry.help;

	return (
		<DashboardTooltip content={help}>
			<span
				className={`inline-flex h-6 min-w-[84px] max-w-full shrink-0 items-center justify-center gap-1 rounded-md px-2.5 text-center text-[11px] font-bold leading-none whitespace-nowrap ${entry.className}`}
			>
				<Icon size={11} className={status === "running" ? "animate-spin" : ""} />
				{entry.label}
			</span>
		</DashboardTooltip>
	);
}

/**
 * One review badge for every surface so a status never renders with two different
 * shapes — or twice — on the same screen.
 */
export function ReviewBadge({
	className = "",
	status,
}: {
	className?: string;
	status: string;
}) {
	const config: Record<
		string,
		{ className: string; help: string; icon: LucideIcon; label: string }
	> = {
		approved: {
			className: "bg-[var(--success-soft)] text-[var(--success-strong)]",
			help: "Đã được người phụ trách phê duyệt.",
			icon: CheckCircle2,
			label: "Đã duyệt",
		},
		draft: {
			className: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]",
			help: "Bản nháp đang soạn, chưa gửi duyệt.",
			icon: PencilLine,
			label: "Bản nháp",
		},
		needs_review: {
			className: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
			help: "Đang chờ người phụ trách xem và phê duyệt.",
			icon: Clock,
			label: "Chờ duyệt",
		},
		rejected: {
			className: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
			help: "Đã bị từ chối; cần chỉnh sửa trước khi gửi lại.",
			icon: XCircle,
			label: "Từ chối",
		},
	};
	const entry = config[status] ?? config.draft!;
	const Icon = entry.icon;

	return (
		<DashboardTooltip content={entry.help}>
			<span
				className={`inline-flex h-6 max-w-full shrink-0 items-center justify-center gap-1 rounded-md px-2.5 text-[11px] font-bold leading-none whitespace-nowrap ${entry.className} ${className}`}
			>
				<Icon size={11} />
				{entry.label}
			</span>
		</DashboardTooltip>
	);
}

export function RiskPill({
	explanation,
	labelPrefix,
	reasons,
	risk,
}: {
	/**
	 * Why this level was assigned. A bare level is an assertion a reviewer has to
	 * take on trust; showing the signals, their categories, and who decided lets
	 * them judge whether the machine actually understood the content.
	 */
	explanation?: RiskExplanation;
	labelPrefix?: string;
	/** Shorthand for an explanation that only carries reasons. */
	reasons?: string[];
	risk: RiskLevel | string;
}) {
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
	const icons: Record<string, LucideIcon> = {
		high: ShieldAlert,
		low: ShieldCheck,
		medium: AlertTriangle,
	};
	const help: Record<string, string> = {
		high: "Rủi ro cao: cần đọc kỹ nội dung và ưu tiên xử lý trước.",
		medium: "Rủi ro trung bình: có tín hiệu cần kiểm tra thêm.",
		low: "Rủi ro thấp: chưa thấy tín hiệu nghiêm trọng trong nội dung hiện có.",
	};
	const Icon = icons[risk] ?? AlertTriangle;
	const detailReasons = explanation?.reasons ?? reasons ?? [];
	const categories = explanation?.categoryLabels ?? [];

	return (
		<DashboardTooltip
			content={
				<div className="space-y-1.5">
					<p>{help[risk] ?? "Mức rủi ro do phân tích gán cho mục này."}</p>
					{categories.length ? (
						<p className="text-[10px] font-bold text-[var(--muted-strong)]">
							Liên quan: {categories.join(" · ")}
						</p>
					) : null}
					{detailReasons.length ? (
						<ul className="list-disc space-y-1 pl-4">
							{detailReasons.map((reason) => (
								<li key={reason}>{reason}</li>
							))}
						</ul>
					) : null}
					{explanation ? (
						<p className="text-[10px] font-medium text-[var(--muted)]">
							{explanation.fromModel
								? "Do mô hình AI phân loại"
								: "Do bộ quy tắc nội bộ phân loại"}
							{explanation.confidence === null
								? ""
								: ` · độ tin cậy ${Math.round(explanation.confidence * 100)}%`}
						</p>
					) : null}
					<p className="text-[10px] font-medium text-[var(--muted)]">
						Đây là mức ưu tiên hỗ trợ rà soát, không phải kết luận đúng/sai.
					</p>
				</div>
			}
		>
			<span
				className={`inline-flex h-6 max-w-full shrink-0 items-center justify-center gap-1 rounded-md px-2.5 text-center text-[11px] font-bold leading-none whitespace-nowrap ${styles[risk] ?? styles.medium}`}
			>
				<Icon size={11} />
				{labelPrefix ? `${labelPrefix}: ` : ""}
				{labels[risk] ?? risk}
			</span>
		</DashboardTooltip>
	);
}

/**
 * Activity events carry a notability, not a content risk. They were rendering
 * through `RiskPill`, which put a red "Cao" shield next to "Đã xóa bài viết" —
 * telling the reader an ordinary editorial action was dangerous content.
 *
 * Routine events get no badge at all: on a feed where almost everything is
 * routine, a green "Thấp" on every row is noise that makes the few rows that
 * genuinely need attention harder to find.
 */
export function ActivityPill({ severity }: { severity: RiskLevel | string }) {
	const config: Record<
		string,
		{ className: string; help: string; icon: LucideIcon; label: string }
	> = {
		high: {
			className: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
			help: "Sự kiện cần được xem lại: có bước trong quy trình không hoàn tất.",
			icon: AlertTriangle,
			label: "Cần xem",
		},
		medium: {
			className: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
			help: "Sự kiện làm thay đổi trạng thái duyệt hoặc xuất bản.",
			icon: Bell,
			label: "Đáng lưu ý",
		},
	};
	const entry = config[severity];
	if (!entry) return null;
	const Icon = entry.icon;

	return (
		<DashboardTooltip content={entry.help}>
			<span
				className={`inline-flex h-6 max-w-full shrink-0 items-center justify-center gap-1 rounded-md px-2.5 text-center text-[11px] font-bold leading-none whitespace-nowrap ${entry.className}`}
			>
				<Icon size={11} />
				{entry.label}
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
			className="inline-flex h-11 max-w-full items-center justify-center gap-2 rounded-md bg-[var(--accent-fill)] px-4 text-[13px] font-bold text-white shadow-sm transition whitespace-nowrap hover:bg-[var(--accent-fill-hover)] disabled:opacity-60"
		>
			{children}
		</button>
	);
}

export function SecondaryButton({
	children,
	disabled,
	onClick,
}: {
	children: ReactNode;
	disabled?: boolean;
	onClick?: () => void | Promise<void>;
}) {
	return (
		<button
			 type="button"
			disabled={disabled}
			onClick={onClick}
			className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-55"
		>
			{children}
		</button>
	);
}
