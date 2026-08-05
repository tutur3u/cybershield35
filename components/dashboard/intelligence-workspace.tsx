"use client";

import { BrainCircuit, ChartColumn, Layers, Megaphone, Radar } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

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
	{ icon: ChartColumn, id: "overview", label: "Phân tích" },
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

	function selectView(nextView: IntelligenceView) {
		const next = new URLSearchParams(searchParams);
		next.set("view", nextView);
		window.history.replaceState(null, "", `${pathname}?${next.toString()}`);
	}

	return (
		<div className="space-y-5">
			<PageHeader
				description="Bức tranh toàn cảnh: cơ cấu rủi ro, nguyên nhân, chủ đề nổi bật và nguồn đang tạo ra chúng."
				icon={BrainCircuit}
				title="Phân tích tình báo"
			/>

			<div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
				{views.map((item) => {
					const Icon = item.icon;
					return (
						<button
							key={item.id}
							type="button"
							aria-pressed={view === item.id}
							onClick={() => selectView(item.id)}
							className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-[12px] font-bold transition ${
								view === item.id
									? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
									: "text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
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
				showProvider={view !== "topics"}
				showStatus={view === "sources"}
			/>

			{view === "topics" ? (
				<IntelligenceTopicsWorkspace />
			) : view === "alerts" ? (
				<IntelligenceClaimsWorkspace />
			) : view === "sources" ? (
				<IntelligenceSourcesWorkspace />
			) : (
				<IntelligenceAnalyticsWorkspace filters={filters} />
			)}
		</div>
	);
}
