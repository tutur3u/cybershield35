"use client";

import { BrainCircuit } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import { IntelligenceClaimsWorkspace, ExecutiveIntelligenceDashboard } from "@/components/dashboard/intelligence-widgets";
import { IntelligenceTopicsWorkspace } from "@/components/dashboard/intelligence-topics-workspace";
import { PageHeader } from "@/components/dashboard/page-header";

const views = [
	{ id: "overview", label: "Tổng quan" },
	{ id: "topics", label: "Chủ đề" },
	{ id: "alerts", label: "Cảnh báo" },
] as const;

export type IntelligenceView = (typeof views)[number]["id"];

export function IntelligenceWorkspace({ view }: { view: IntelligenceView }) {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	function selectView(nextView: IntelligenceView) {
		const next = new URLSearchParams(searchParams);
		next.set("view", nextView);
		window.history.replaceState(null, "", `${pathname}?${next.toString()}`);
	}

	return (
		<div className="space-y-5">
			<PageHeader
				description="Một nơi để theo dõi xu hướng, chủ đề và cảnh báo có liên kết ngược về bằng chứng."
				icon={BrainCircuit}
				title="Tình báo"
			/>
			<div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
				{views.map((item) => (
					<button
						key={item.id}
						type="button"
						aria-pressed={view === item.id}
						onClick={() => selectView(item.id)}
						className={`h-9 whitespace-nowrap rounded-md px-4 text-[12px] font-bold transition ${view === item.id ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"}`}
					>
						{item.label}
					</button>
				))}
			</div>
			{view === "topics" ? (
				<IntelligenceTopicsWorkspace />
			) : view === "alerts" ? (
				<IntelligenceClaimsWorkspace />
			) : (
				<ExecutiveIntelligenceDashboard />
			)}
		</div>
	);
}
