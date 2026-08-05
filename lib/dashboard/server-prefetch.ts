import "server-only";

import type { QueryClient } from "@tanstack/react-query";
import { io } from "next/cache";

import type {
	DashboardPage,
	IntelligenceFilters,
	TimelineFilters,
} from "@/components/dashboard/types";
import {
	getIntelligenceOverview,
	listIntelligenceActivity,
	listIntelligenceClaims,
	listIntelligenceEvidence,
	listIntelligenceFacebookPages,
	listIntelligenceSources,
	listIntelligenceTopics,
} from "@/lib/dashboard/intelligence-server";
import { getIntelligenceAnalytics } from "@/lib/dashboard/intelligence-analytics";
import { getWorkflowPipeline } from "@/lib/dashboard/pipeline-server";
import { listTimeline } from "@/lib/dashboard/timeline-server";
import {
	dashboardQueryKeys,
	defaultIntelligenceFilters,
	serializeIntelligenceFilters,
} from "@/lib/dashboard/query-keys";
import { getTopicDetailPage } from "@/lib/workers/topics";
import { getOperationsOverview } from "@/lib/operations/server";

type FirstPage<T> = {
	pages: [T];
	pageParams: [null];
};

export async function prefetchDashboardRouteData(
	queryClient: QueryClient,
	page: DashboardPage,
	context: { filters?: IntelligenceFilters; topicSlug?: string } = {},
) {
	await io();
	const tasks: Promise<void>[] = [];
	const filters = context.filters ?? defaultIntelligenceFilters;
	const params = serializeIntelligenceFilters(filters);

	if (["overview", "reports"].includes(page)) {
		tasks.push(
			getIntelligenceOverview(filters).then((overview) => {
				queryClient.setQueryData(
					dashboardQueryKeys.intelligenceOverview(params),
					overview,
				);
			}),
		);
	}

	if (page === "overview") {
		tasks.push(
			getWorkflowPipeline().then((pipeline) => {
				queryClient.setQueryData(dashboardQueryKeys.workflowPipeline(), pipeline);
			}),
			prefetchFirstPage(
				queryClient,
				dashboardQueryKeys.intelligenceActivityInfinite(params, 8),
				listIntelligenceActivity({ filters, limit: 8 }),
			),
		);
	}

	if (["alerts", "overview", "sources", "topics", "evidence", "audit"].includes(page)) {
		tasks.push(
			listIntelligenceFacebookPages().then((pages) => {
				queryClient.setQueryData(
					dashboardQueryKeys.intelligenceFacebookPages(),
					pages,
				);
			}),
		);
	}

	if (page === "alerts") {
		tasks.push(
			prefetchFirstPage(
				queryClient,
				dashboardQueryKeys.intelligenceClaimsInfinite(params, 24),
				listIntelligenceClaims({ filters, limit: 24 }),
			),
		);
	}

	if (page === "evidence") {
		tasks.push(
			prefetchFirstPage(
				queryClient,
				dashboardQueryKeys.intelligenceEvidenceInfinite(params, 40),
				listIntelligenceEvidence({ filters, limit: 40 }),
			),
		);
	}

	if (page === "topics") {
		tasks.push(
			prefetchFirstPage(
				queryClient,
				dashboardQueryKeys.intelligenceTopicsInfinite(params, 24),
				listIntelligenceTopics({ filters, limit: 24 }),
			),
		);
	}

	if (page === "topic-detail" && context.topicSlug) {
		const slug = context.topicSlug;
		tasks.push(
			getTopicDetailPage({ slug, limit: 12 }).then((topic) => {
				if (!topic) return;
				queryClient.setQueryData<FirstPage<typeof topic>>(
					dashboardQueryKeys.topicDetailInfinite(slug, 12),
					{ pages: [topic], pageParams: [null] },
				);
			}),
		);
	}

	if (page === "sources") {
		tasks.push(
			prefetchFirstPage(
				queryClient,
				dashboardQueryKeys.intelligenceSourcesInfinite(params, 24),
				listIntelligenceSources({ filters, limit: 24 }),
			),
		);
	}

	if (page === "audit") {
		tasks.push(
			prefetchFirstPage(
				queryClient,
				dashboardQueryKeys.intelligenceActivityInfinite(params, 30),
				listIntelligenceActivity({ filters, limit: 30 }),
			),
		);
	}

	if (page === "operations") {
		tasks.push(
			getOperationsOverview().then((overview) => {
				queryClient.setQueryData(
					dashboardQueryKeys.operationsOverview(),
					overview,
				);
			}),
		);
	}

	await Promise.allSettled(tasks);
}

export async function prefetchIntelligenceAnalytics(
	queryClient: QueryClient,
	filters: IntelligenceFilters,
) {
	await io();
	const analytics = await getIntelligenceAnalytics(filters);
	queryClient.setQueryData(
		dashboardQueryKeys.intelligenceAnalytics(serializeIntelligenceFilters(filters)),
		analytics,
	);
}

export async function prefetchTimeline(
	queryClient: QueryClient,
	filters: TimelineFilters,
	limit = 30,
) {
	await io();
	await prefetchFirstPage(
		queryClient,
		dashboardQueryKeys.timelineInfinite(filters, limit),
		listTimeline({ filters, limit }),
	);
}

async function prefetchFirstPage<T>(
	queryClient: QueryClient,
	queryKey: readonly unknown[],
	pagePromise: Promise<T>,
) {
	const page = await pagePromise;
	queryClient.setQueryData<FirstPage<T>>(queryKey, {
		pages: [page],
		pageParams: [null],
	});
}
