"use client";

import {
	type InfiniteData,
	useInfiniteQuery,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { CalendarDays, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import type {
	EvidenceTriageView,
	TimelinePage,
	TimelinePost,
} from "@/components/dashboard/types";
import {
	intelligenceFacebookPagesQueryOptions,
	timelineFacetsQueryOptions,
	timelineHeadQueryOptions,
	timelineInfiniteQueryOptions,
} from "@/lib/dashboard/client-queries";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { serializeTimelineFilters } from "@/lib/dashboard/timeline-query";

import { TimelineDayGroups } from "./timeline-card";
import { TimelineDenseList } from "./timeline-list";
import { TimelineToolbar } from "./timeline-toolbar";
import { useVisibleDay } from "./use-visible-day";
import {
	filtersFromParams,
	LAST_SEEN_STORAGE_KEY,
	toolButtonClass,
} from "./timeline-utils";

const EvidenceTriageSheet = dynamic(
	() => import("@/components/dashboard/evidence-triage-sheet"),
	{ loading: () => null, ssr: false },
);
const EvidenceDraftSheet = dynamic(
	() => import("@/components/dashboard/evidence-draft-sheet"),
	{ loading: () => null, ssr: false },
);

export function EvidenceTimeline() {
	const queryClient = useQueryClient();
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [draftId, setDraftId] = useState<string | null>(null);
	const [articleBusyId, setArticleBusyId] = useState<string | null>(null);
	const [articleError, setArticleError] = useState("");
	const [currentTime] = useState(() => Date.now());
	const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
	const view = searchParams.get("view") === "list" ? "list" : "timeline";
	const visibleDay = useVisibleDay(view === "timeline");
	const timelineQuery = useInfiniteQuery(timelineInfiniteQueryOptions(filters, 30));
	const headQuery = useQuery(timelineHeadQueryOptions(filters, lastSeenAt));
	const pagesQuery = useQuery(intelligenceFacebookPagesQueryOptions());
	// Fetched only while the panel is open: the counts matter when someone is
	// choosing, and an aggregate across every filter is not worth running on a
	// page that is merely being read.
	const facetsQuery = useQuery(timelineFacetsQueryOptions(filters, advancedOpen));
	const posts = useMemo(() => {
		const map = new Map<string, TimelinePost>();
		for (const post of timelineQuery.data?.pages.flatMap((page) => page.items) ?? []) {
			map.set(post.id, post);
		}
		return [...map.values()];
	}, [timelineQuery.data]);
	const selectedPost = posts.find((post) => post.id === selectedId) ?? null;
	const draftPost = posts.find((post) => post.id === draftId) ?? null;
	const total = timelineQuery.data?.pages[0]?.total ?? 0;

	// The "new since your last visit" marker is a per-viewer reading position, so it
	// lives in the browser rather than in shared workspace state.
	useEffect(() => {
		const stored = window.localStorage.getItem(LAST_SEEN_STORAGE_KEY);
		if (stored) {
			setLastSeenAt(stored);
			return;
		}
		const now = new Date().toISOString();
		window.localStorage.setItem(LAST_SEEN_STORAGE_KEY, now);
		setLastSeenAt(now);
	}, []);

	const lastSeenMs = lastSeenAt ? Date.parse(lastSeenAt) : Number.POSITIVE_INFINITY;
	const loadedNewCount = posts.filter(
		(post) => Date.parse(post.createdAt) > lastSeenMs,
	).length;
	const { fetchNextPage, hasNextPage, isFetchingNextPage } = timelineQuery;

	useEffect(() => {
		const element = sentinelRef.current;
		if (!element || !hasNextPage) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
			},
			{ rootMargin: "500px" },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

	const updateParam = useCallback(
		(key: string, value: string, push = false) => {
			const next = new URLSearchParams(searchParams);
			if (!value || value === "all") next.delete(key);
			else next.set(key, value);
			const href = next.size ? `${pathname}?${next.toString()}` : pathname;
			startTransition(() => {
				if (push) window.history.pushState(null, "", href);
				else window.history.replaceState(null, "", href);
			});
		},
		[pathname, searchParams],
	);

	const clearFilters = useCallback(() => {
		const next = new URLSearchParams();
		if (view === "list") next.set("view", "list");
		window.history.pushState(null, "", next.size ? `${pathname}?${next}` : pathname);
	}, [pathname, view]);

	const refresh = useCallback(async () => {
		await queryClient.invalidateQueries({ queryKey: ["dashboard", "timeline"] });
		window.scrollTo({ behavior: "smooth", top: 0 });
	}, [queryClient]);

	const markAllSeen = useCallback(async () => {
		const marker = headQuery.data?.newestCollectedAt ?? new Date().toISOString();
		window.localStorage.setItem(LAST_SEEN_STORAGE_KEY, marker);
		setLastSeenAt(marker);
		await queryClient.invalidateQueries({
			queryKey: dashboardQueryKeys.timelineHead(filters),
		});
	}, [filters, headQuery.data?.newestCollectedAt, queryClient]);

	const createArticleFrom = useCallback(
		async (post: TimelinePost) => {
			setArticleBusyId(post.id);
			setArticleError("");
			try {
				const response = await fetch(`/api/evidence/${post.id}/article`, {
					body: JSON.stringify({}),
					cache: "no-store",
					headers: { "Content-Type": "application/json" },
					method: "POST",
				});
				const payload = await response.json().catch(() => null);
				if (!response.ok) {
					throw new Error(payload?.error ?? "Không thể soạn bài viết từ nội dung này.");
				}
				router.push(String(payload.href));
			} catch (error) {
				setArticleError(
					error instanceof Error ? error.message : "Không thể soạn bài viết.",
				);
				setArticleBusyId(null);
			}
		},
		[router],
	);

	function optimisticUpdate(
		patch: Partial<
			Pick<EvidenceTriageView, "assigneeUserId" | "dueAt" | "isPinned" | "status">
		>,
	) {
		const key = dashboardQueryKeys.timelineInfinite(filters, 30);
		const previous = queryClient.getQueryData<InfiniteData<TimelinePage>>(key);
		queryClient.setQueryData<InfiniteData<TimelinePage>>(key, (current) =>
			current
				? {
						...current,
						pages: current.pages.map((page) => ({
							...page,
							items: page.items.map((post) =>
								post.id === selectedId
									? {
											...post,
											triage: {
												...post.triage,
												...patch,
												updatedAt: new Date().toISOString(),
											},
										}
									: post,
							),
						})),
					}
				: current,
		);
		return () => queryClient.setQueryData(key, previous);
	}

	const exportHref = `/api/intelligence/timeline/export.csv?${new URLSearchParams(
		serializeTimelineFilters(filters),
	).toString()}`;

	return (
		<div className="space-y-4">
			<TimelineToolbar
				advancedOpen={advancedOpen}
				exportHref={exportHref}
				facets={facetsQuery.data}
				filters={filters}
				isPending={isPending}
				loadedNewCount={loadedNewCount}
				onClearFilters={clearFilters}
				onMarkSeen={() => void markAllSeen()}
				onParamChange={updateParam}
				onRefresh={() => void refresh()}
				onToggleAdvanced={setAdvancedOpen}
				pages={pagesQuery.data ?? []}
				posts={posts}
				refreshing={timelineQuery.isRefetching}
				total={total}
				view={view}
				visibleDay={visibleDay}
			/>

			{articleError ? (
				<div
					role="alert"
					className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-xs font-bold text-[var(--danger-strong)]"
				>
					{articleError}
				</div>
			) : null}

			{timelineQuery.isError ? (
				<ErrorState
					message={timelineQuery.error.message}
					onRetry={() => void timelineQuery.refetch()}
				/>
			) : null}
			{!timelineQuery.isPending && !posts.length ? (
				<EmptyState onClear={clearFilters} />
			) : null}

			{view === "list" ? (
				<TimelineDenseList
					lastSeenMs={lastSeenMs}
					onTriage={setSelectedId}
					posts={posts}
				/>
			) : (
				<TimelineDayGroups
					articleBusyId={articleBusyId}
					currentTime={currentTime}
					lastSeenMs={lastSeenMs}
					onCreateArticle={(post) => void createArticleFrom(post)}
					onDraft={setDraftId}
					onTriage={setSelectedId}
					posts={posts}
				/>
			)}

			<div ref={sentinelRef} aria-hidden className="h-px" />
			{timelineQuery.hasNextPage ? (
				<div className="flex flex-col items-center gap-2 py-4">
					<p className="text-xs font-semibold text-[var(--muted)]">
						Đã hiển thị {posts.length.toLocaleString("vi-VN")} /{" "}
						{total.toLocaleString("vi-VN")} bài
					</p>
					<button
						type="button"
						disabled={timelineQuery.isFetchingNextPage}
						onClick={() => void timelineQuery.fetchNextPage()}
						className={toolButtonClass}
					>
						<RefreshCw
							size={14}
							className={timelineQuery.isFetchingNextPage ? "animate-spin" : ""}
						/>
						{timelineQuery.isFetchingNextPage ? "Đang tải thêm…" : "Tải thêm bài viết"}
					</button>
				</div>
			) : posts.length ? (
				<p className="py-4 text-center text-xs font-semibold text-[var(--muted)]">
					Đã hiển thị toàn bộ {posts.length.toLocaleString("vi-VN")} kết quả.
				</p>
			) : null}

			{selectedPost ? (
				<EvidenceTriageSheet
					open
					post={selectedPost}
					onOpenChange={(open) => {
						if (!open) setSelectedId(null);
					}}
					onOptimisticUpdate={optimisticUpdate}
				/>
			) : null}
			{draftPost ? (
				<EvidenceDraftSheet
					open
					post={draftPost}
					onOpenChange={(open) => {
						if (!open) setDraftId(null);
					}}
				/>
			) : null}
		</div>
	);
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<div
			role="alert"
			className="rounded-xl border border-[var(--danger-strong)] bg-[var(--surface)] p-6 text-center"
		>
			<p className="font-bold text-[var(--danger-strong)]">
				Không thể tải dòng thời gian
			</p>
			<p className="mt-2 text-sm text-[var(--muted)]">{message}</p>
			<button type="button" onClick={onRetry} className={`${toolButtonClass} mt-4`}>
				<RefreshCw size={14} />
				Thử lại
			</button>
		</div>
	);
}

function EmptyState({ onClear }: { onClear: () => void }) {
	return (
		<div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
			<CalendarDays className="mx-auto text-[var(--muted)]" />
			<h2 className="mt-3 font-bold text-[var(--foreground)]">
				Không có bài viết phù hợp
			</h2>
			<p className="mt-2 text-sm text-[var(--muted)]">
				Hãy nới bộ lọc hoặc xóa các điều kiện hiện tại.
			</p>
			<button type="button" onClick={onClear} className={`${toolButtonClass} mt-4`}>
				Xóa bộ lọc
			</button>
		</div>
	);
}
