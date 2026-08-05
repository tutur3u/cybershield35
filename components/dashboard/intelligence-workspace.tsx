"use client";

import { BrainCircuit, ChartColumn, Layers, Megaphone, Radar } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { IntelligenceAnalyticsWorkspace } from "@/components/dashboard/intelligence/analytics-workspace";
import {
	IntelligenceClaimsWorkspace,
	IntelligenceSourcesWorkspace,
} from "@/components/dashboard/intelligence-widgets";
import { IntelligenceTopicsWorkspace } from "@/components/dashboard/intelligence-topics-workspace";
import {
	IntelligenceFilterBar,
	useIntelligenceFiltersFromUrl,
} from "@/components/dashboard/intelligence-workspace-shared";
import { PageHeader } from "@/components/dashboard/page-header";

const views = [
	{ icon: ChartColumn, id: "overview", label: "Tổng hợp" },
	{ icon: Layers, id: "topics", label: "Chủ đề" },
	{ icon: Megaphone, id: "alerts", label: "Nhận định" },
	{ icon: Radar, id: "sources", label: "Nguồn" },
] as const;

export type IntelligenceView = (typeof views)[number]["id"];

/**
 * The analysis workspace. It answers "what is happening and why" with charts and
 * breakdowns; the overview page answers "what needs doing right now".
 */
export function IntelligenceWorkspace({ view }: { view: IntelligenceView }) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [filters, setFilter] = useIntelligenceFiltersFromUrl();

	// The tab has to be local state. `view` arrives from the server page's
	// searchParams, and the URL was previously rewritten with a bare
	// `history.replaceState`, which the router never sees — so the prop stayed on
	// whatever the page first rendered with and clicking a tab did nothing at all.
	// Keeping it local also makes switching instant instead of a server round trip.
	const [selectedView, setSelectedView] = useState<IntelligenceView>(view);
	const [viewFromServer, setViewFromServer] = useState<IntelligenceView>(view);
	// A fresh navigation (a link carrying ?view=…) must still win over the local
	// choice; adjusting during render avoids a flash of the stale tab.
	if (view !== viewFromServer) {
		setViewFromServer(view);
		setSelectedView(view);
	}
	const activeView = selectedView;

	function selectView(nextView: IntelligenceView) {
		setSelectedView(nextView);
		// URL stays in step so the tab can be linked and survives a reload, but
		// without asking the router to re-render what we already switched.
		const next = new URLSearchParams(searchParams);
		next.set("view", nextView);
		window.history.replaceState(null, "", `${pathname}?${next.toString()}`);
	}

	return (
		<div className="space-y-5">
			<PageHeader
				description="Bức tranh toàn cảnh: cơ cấu rủi ro, nguyên nhân, chủ đề nổi bật và nguồn đang tạo ra chúng."
				icon={BrainCircuit}
				title="Phân tích"
			/>

			<div
				role="tablist"
				aria-label="Chế độ xem phân tích"
				className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1"
			>
				{views.map((item) => {
					const Icon = item.icon;
					const isActive = activeView === item.id;
					return (
						<button
							key={item.id}
							type="button"
							role="tab"
							id={`intelligence-tab-${item.id}`}
							aria-controls="intelligence-tabpanel"
							aria-selected={isActive}
							tabIndex={isActive ? 0 : -1}
							onClick={() => selectView(item.id)}
							onKeyDown={(event) => {
								const delta =
									event.key === "ArrowRight"
										? 1
										: event.key === "ArrowLeft"
											? -1
											: 0;
								if (!delta) return;
								event.preventDefault();
								const index = views.findIndex(
									(candidate) => candidate.id === activeView,
								);
								const next =
									views[(index + delta + views.length) % views.length];
								if (!next) return;
								selectView(next.id);
								document
									.getElementById(`intelligence-tab-${next.id}`)
									?.focus();
							}}
							className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-[12px] font-bold transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
								isActive
									? "bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[inset_0_0_0_1px_var(--accent)]"
									: "text-[var(--muted-strong)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
							}`}
						>
							<Icon size={14} />
							{item.label}
						</button>
					);
				})}
			</div>

			<IntelligenceFilterBar
				filters={filters}
				setFilter={setFilter}
				showProvider={activeView !== "topics"}
				showStatus={activeView === "sources"}
			/>

			<div
				role="tabpanel"
				id="intelligence-tabpanel"
				aria-labelledby={`intelligence-tab-${activeView}`}
			>
				{activeView === "topics" ? (
					<IntelligenceTopicsWorkspace />
				) : activeView === "alerts" ? (
					<IntelligenceClaimsWorkspace />
				) : activeView === "sources" ? (
					<IntelligenceSourcesWorkspace />
				) : (
					<IntelligenceAnalyticsWorkspace filters={filters} />
				)}
			</div>
		</div>
	);
}
