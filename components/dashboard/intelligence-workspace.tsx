"use client";

import {
	BrainCircuit,
	ChartColumn,
	Layers,
	Megaphone,
	Radar,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { WorkspaceTabs } from "./workspace-tabs";

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

	const requestedView = searchParams.get("view");
	const activeView =
		views.find((item) => item.id === requestedView)?.id ?? view;

	function selectView(nextView: IntelligenceView) {
		// URL stays in step so the tab can be linked and survives a reload, but
		// without asking the router to re-render what we already switched.
		const next = new URLSearchParams(searchParams);
		next.set("view", nextView);
		window.history.pushState(null, "", `${pathname}?${next.toString()}`);
	}

	return (
		<div className="space-y-5">
			<PageHeader
				description="Bức tranh toàn cảnh: cơ cấu rủi ro, nguyên nhân, chủ đề nổi bật và nguồn đang tạo ra chúng."
				icon={BrainCircuit}
				title="Phân tích"
			/>

			<WorkspaceTabs
				items={views}
				value={activeView}
				onChange={selectView}
				label="Chế độ xem phân tích"
			>
				<IntelligenceFilterBar
					filters={filters}
					setFilter={setFilter}
					showProvider={activeView !== "topics"}
					showStatus={activeView === "sources"}
				/>

				<div>
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
			</WorkspaceTabs>
		</div>
	);
}
