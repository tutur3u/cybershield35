"use client";

import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	Check,
	ChevronDown,
	ChevronUp,
	LoaderCircle,
	Radar,
} from "lucide-react";
import { useState } from "react";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import { ProgressBar } from "@/components/dashboard/ui-primitives";

type ScanProgressStage = {
	id: string;
	label: string;
	message: string | null;
	status: "completed" | "failed" | "pending" | "running" | "waiting";
};

type ScanProgress = {
	errorMessage: string | null;
	evidenceCount: number;
	highRiskCount: number;
	percent: number;
	scanId: string;
	stages: ScanProgressStage[];
	status: string;
	statusMessage: string | null;
	title: string;
};

/**
 * A live account of every scan currently running, anywhere.
 *
 * The progress lives on the server, so this reattaches on mount rather than
 * tracking runs the browser happened to start. Navigating away, reloading, or
 * opening a second tab all show the same thing — which is the truth, because the
 * work was never tied to the page in the first place.
 */
export function ScanProgressDock() {
	// Collapsed by default: a scan takes minutes, and an expanded panel sitting
	// over the page that whole time is in the way of the work it is reporting on.
	const [collapsed, setCollapsed] = useState(true);
	const query = useQuery({
		queryFn: async (): Promise<ScanProgress[]> => {
			const response = await fetch("/api/scans/active", {
				cache: "no-store",
				credentials: "same-origin",
				headers: { Accept: "application/json" },
			});
			if (!response.ok) return [];
			const payload = (await response.json()) as { scans?: ScanProgress[] };
			return payload.scans ?? [];
		},
		queryKey: ["scan-progress", "active"],
		// Frequent enough to feel live, cheap enough to leave running: the query
		// only reads job rows and their newest events.
		refetchInterval: (result) => (result.state.data?.length ? 2_500 : 15_000),
		refetchOnWindowFocus: true,
	});

	const scans = query.data ?? [];
	if (!scans.length) return null;

	return (
		<aside
			aria-label="Tiến độ quét đang chạy"
			aria-live="polite"
			className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_18px_45px_rgb(0_0_0/0.28)] sm:inset-x-auto sm:right-4"
		>
			<div
				className={`flex items-center gap-2 px-3 py-2.5 ${
					// The divider separates the header from the list; with nothing
					// below it, it reads as a stray line under the panel.
					collapsed ? "" : "border-b border-[var(--divider)]"
				}`}
			>
				<Radar
					aria-hidden
					className="shrink-0 animate-pulse text-[var(--accent-strong)]"
					size={15}
				/>
				<p className="min-w-0 flex-1 truncate text-[12px] font-bold text-[var(--foreground)]">
					Đang quét {scans.length} nguồn
				</p>
				<button
					aria-expanded={!collapsed}
					className="shrink-0 rounded-md p-1 text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
					onClick={() => setCollapsed((value) => !value)}
					title={collapsed ? "Mở rộng" : "Thu gọn"}
					type="button"
				>
					{collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
				</button>
			</div>

			{collapsed ? null : (
				<div className="max-h-[52vh] divide-y divide-[var(--divider)] overflow-y-auto">
					{scans.map((scan) => (
						<ScanProgressRow key={scan.scanId} scan={scan} />
					))}
				</div>
			)}
		</aside>
	);
}

function ScanProgressRow({ scan }: { scan: ScanProgress }) {
	const failed = scan.status === "failed" || scan.status === "retrying";

	return (
		<div className="px-3 py-3">
			<div className="flex items-start justify-between gap-2">
				<IntentPrefetchLink
					className="min-w-0 flex-1 truncate text-[12px] font-bold text-[var(--foreground)] hover:text-[var(--accent-strong)]"
					href={`/scans/${scan.scanId}`}
				>
					{scan.title}
				</IntentPrefetchLink>
				<span className="shrink-0 text-[11px] font-bold text-[var(--muted)]">
					{scan.percent}%
				</span>
			</div>

			<div className="mt-1.5">
				<ProgressBar value={scan.percent} />
			</div>

			{scan.statusMessage ? (
				<p
					className={`mt-1.5 line-clamp-2 text-[11px] leading-4 ${
						failed
							? "font-semibold text-[var(--danger-strong)]"
							: "text-[var(--muted)]"
					}`}
				>
					{scan.statusMessage}
				</p>
			) : null}

			<ol className="mt-2 flex flex-wrap items-center gap-1">
				{scan.stages.map((stage) => (
					<li key={stage.id}>
						<span
							className={`inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-bold ${stageClass(stage.status)}`}
							title={stage.message ?? stage.label}
						>
							<StageIcon status={stage.status} />
							{stage.label}
						</span>
					</li>
				))}
			</ol>

			{scan.evidenceCount ? (
				<p className="mt-1.5 text-[10px] font-semibold text-[var(--muted)]">
					{scan.evidenceCount.toLocaleString("vi-VN")} bằng chứng
					{scan.highRiskCount
						? ` · ${scan.highRiskCount.toLocaleString("vi-VN")} rủi ro cao`
						: ""}
				</p>
			) : null}
		</div>
	);
}

function StageIcon({ status }: { status: ScanProgressStage["status"] }) {
	if (status === "completed") return <Check aria-hidden size={9} />;
	if (status === "failed") return <AlertTriangle aria-hidden size={9} />;
	if (status === "running") {
		return <LoaderCircle aria-hidden className="animate-spin" size={9} />;
	}
	return null;
}

function stageClass(status: ScanProgressStage["status"]) {
	switch (status) {
		case "completed":
			return "bg-[var(--success-soft)] text-[var(--success-strong)]";
		case "failed":
			return "bg-[var(--danger-soft)] text-[var(--danger-strong)]";
		case "running":
			return "bg-[var(--accent-soft)] text-[var(--accent-strong)]";
		case "waiting":
			return "bg-[var(--warning-soft)] text-[var(--warning-strong)]";
		default:
			return "text-[var(--muted)]";
	}
}
