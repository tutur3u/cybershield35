"use client";

import { LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";

/** Distinguish unavailable data from a genuine empty result, including stale-data refreshes. */
export function QueryFeedback({
	pending,
	failed,
	onRetry,
}: {
	pending: boolean;
	failed: boolean;
	onRetry: () => void;
}) {
	if (failed)
		return (
			<div
				role="alert"
				className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--warning-border)] bg-[var(--warning-soft)] px-5 py-4 text-sm text-[var(--warning-strong)]"
			>
				<span className="inline-flex items-center gap-2">
					<TriangleAlert size={17} />
					Không thể tải dữ liệu mới nhất. Vui lòng thử lại.
				</span>
				<button
					type="button"
					onClick={onRetry}
					className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-current px-3 font-semibold"
				>
					<RefreshCw size={14} />
					Thử lại
				</button>
			</div>
		);
	if (pending)
		return (
			<div
				role="status"
				className="flex items-center justify-center gap-2 p-8 text-sm text-[var(--muted)]"
			>
				<LoaderCircle
					size={18}
					className="animate-spin motion-reduce:animate-none"
				/>
				Đang tải dữ liệu…
			</div>
		);
	return null;
}
