"use client";

import {
	type InfiniteData,
	useInfiniteQuery,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	CalendarDays,
	Download,
	ExternalLink,
	Filter,
	List,
	MessageSquareText,
	Pin,
	RefreshCw,
	Search,
	SlidersHorizontal,
	Sparkles,
	Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import {
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import {
	formatIntelligenceDate,
	intelligenceProviderLabel,
} from "@/components/dashboard/intelligence-workspace-shared";
import type {
	EvidenceTriageView,
	TimelineFilters,
	TimelinePage,
	TimelinePost,
} from "@/components/dashboard/types";
import { RiskPill } from "@/components/dashboard/ui-primitives";
import {
	intelligenceFacebookPagesQueryOptions,
	timelineHeadQueryOptions,
	timelineInfiniteQueryOptions,
} from "@/lib/dashboard/client-queries";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { serializeTimelineFilters } from "@/lib/dashboard/timeline-query";

const EvidenceTriageSheet = dynamic(
	() => import("@/components/dashboard/evidence-triage-sheet"),
	{ loading: () => null, ssr: false },
);

const triageLabels: Record<EvidenceTriageView["status"], string> = {
	action_required: "Cần hành động",
	dismissed: "Bỏ qua",
	new: "Mới",
	reviewing: "Đang xem xét",
	resolved: "Đã giải quyết",
};

export function EvidenceTimeline() {
	const queryClient = useQueryClient();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [acknowledgedHead, setAcknowledgedHead] = useState<string | null>(null);
	const [currentTime] = useState(() => Date.now());
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const queryTimer = useRef<number | null>(null);
	const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
	const view = searchParams.get("view") === "list" ? "list" : "timeline";
	const timelineQuery = useInfiniteQuery(timelineInfiniteQueryOptions(filters, 30));
	const headQuery = useQuery(timelineHeadQueryOptions(filters));
	const pagesQuery = useQuery(intelligenceFacebookPagesQueryOptions());
	const posts = useMemo(() => {
		const map = new Map<string, TimelinePost>();
		for (const post of timelineQuery.data?.pages.flatMap((page) => page.items) ?? []) map.set(post.id, post);
		return [...map.values()];
	}, [timelineQuery.data]);
	const selectedPost = posts.find((post) => post.id === selectedId) ?? null;
	const total = timelineQuery.data?.pages[0]?.total ?? 0;

	const updatesAvailable = useMemo(() => {
		const head = headQuery.data;
		const firstPage = timelineQuery.data?.pages[0];
		if (!head || !firstPage) return false;
		const signature = `${head.newestPostId ?? ""}:${head.total}:${head.latestTriageUpdatedAt ?? ""}`;
		if (acknowledgedHead === signature) return false;
		const first = firstPage.items[0];
		const newestChanged = head.newestPostId !== (first?.id ?? null) || head.total !== firstPage.total;
		const loadedTriageVersion = posts.reduce<string | null>((latest, post) => {
			const value = post.triage.updatedAt;
			return value && (!latest || value > latest) ? value : latest;
		}, null);
		const triageChanged = Boolean(head.latestTriageUpdatedAt && (!loadedTriageVersion || head.latestTriageUpdatedAt > loadedTriageVersion));
		return newestChanged || triageChanged;
	}, [acknowledgedHead, headQuery.data, posts, timelineQuery.data]);
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

	useEffect(() => () => {
		if (queryTimer.current !== null) window.clearTimeout(queryTimer.current);
	}, []);

	function updateParam(key: string, value: string, push = false) {
		const next = new URLSearchParams(searchParams);
		if (!value || value === "all") next.delete(key);
		else next.set(key, value);
		const href = next.size ? `${pathname}?${next.toString()}` : pathname;
		startTransition(() => {
			if (push) window.history.pushState(null, "", href);
			else window.history.replaceState(null, "", href);
		});
	}

	function clearFilters() {
		const next = new URLSearchParams();
		if (view === "list") next.set("view", "list");
		window.history.pushState(null, "", next.size ? `${pathname}?${next}` : pathname);
	}

	async function refresh() {
		const head = headQuery.data;
		if (head) setAcknowledgedHead(`${head.newestPostId ?? ""}:${head.total}:${head.latestTriageUpdatedAt ?? ""}`);
		await queryClient.invalidateQueries({ queryKey: ["dashboard", "timeline"] });
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	function optimisticUpdate(patch: Partial<Pick<EvidenceTriageView, "assigneeUserId" | "dueAt" | "isPinned" | "status">>) {
		const key = dashboardQueryKeys.timelineInfinite(filters, 30);
		const previous = queryClient.getQueryData<InfiniteData<TimelinePage>>(key);
		queryClient.setQueryData<InfiniteData<TimelinePage>>(key, (current) => {
			if (!current) return current;
			return {
				...current,
				pages: current.pages.map((page) => ({
					...page,
					items: page.items.map((post) =>
						post.id === selectedId
							? { ...post, triage: { ...post.triage, ...patch, updatedAt: new Date().toISOString() } }
							: post,
					),
				})),
			};
		});
		return () => queryClient.setQueryData(key, previous);
	}

	const activeFilters = activeFilterEntries(filters);
	const exportHref = `/api/intelligence/timeline/export.csv?${new URLSearchParams(serializeTimelineFilters(filters)).toString()}`;

	return (
		<div className="space-y-4">
			<div className="sticky top-2 z-20 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-[var(--shadow-soft)] backdrop-blur">
				<div className="flex flex-col gap-2 xl:flex-row xl:items-center">
					<div className="inline-flex h-10 shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-soft)] p-1" aria-label="Kiểu hiển thị">
						<ViewButton active={view === "timeline"} icon={CalendarDays} label="Timeline" onClick={() => updateParam("view", "", true)} />
						<ViewButton active={view === "list"} icon={List} label="Danh sách" onClick={() => updateParam("view", "list", true)} />
					</div>
					<label className="relative min-w-0 flex-1">
						<Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
						<input
							key={filters.query ?? ""}
							defaultValue={filters.query ?? ""}
							onChange={(event) => {
								if (queryTimer.current !== null) window.clearTimeout(queryTimer.current);
								queryTimer.current = window.setTimeout(() => updateParam("q", event.target.value), 250);
							}}
							placeholder="Tìm nội dung, nguồn hoặc tác giả…"
							className={`${inputClass} pl-9`}
						/>
					</label>
					<select aria-label="Sắp xếp" value={filters.sort ?? "published-desc"} onChange={(event) => updateParam("sort", event.target.value)} className={`${inputClass} xl:w-52`}>
						<option value="published-desc">Mới đăng trước</option>
						<option value="published-asc">Cũ đăng trước</option>
						<option value="engagement-desc">Tương tác cao</option>
						<option value="risk-desc">Rủi ro cao</option>
						<option value="triage-updated-desc">Xử lý mới cập nhật</option>
					</select>
					<div className="flex shrink-0 gap-2">
						<ToolButton label="Bộ lọc" icon={SlidersHorizontal} onClick={() => setAdvancedOpen((value) => !value)} active={advancedOpen} />
						<ToolButton label="Làm mới" icon={RefreshCw} onClick={() => void refresh()} spinning={timelineQuery.isRefetching} />
						<a href={exportHref} className={toolButtonClass} title="Xuất CSV theo bộ lọc"><Download size={15} /><span className="hidden sm:inline">CSV</span></a>
					</div>
				</div>

				{advancedOpen ? (
					<div className="grid gap-2 border-t border-[var(--border)] pt-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
						<FilterSelect label="Khoảng thời gian" value={filters.timeRange ?? "all"} onChange={(value) => updateParam("timeRange", value)} options={[["all", "Tất cả"], ["7d", "7 ngày"], ["30d", "30 ngày"], ["90d", "90 ngày"]]} />
						<FilterSelect label="Fanpage" value={filters.facebookPage ?? ""} onChange={(value) => updateParam("facebookPage", value)} options={[["", "Tất cả fanpage"], ...(pagesQuery.data ?? []).map((page) => [page.value, page.label] as [string, string])]} />
						<FilterSelect label="Provider" value={filters.provider ?? ""} onChange={(value) => updateParam("provider", value)} options={[["", "Tất cả provider"], ["apify_facebook_posts", "Apify bài viết"], ["apify_facebook_comments", "Apify bình luận"], ["apify_facebook_groups", "Apify nhóm"], ["firecrawl", "Firecrawl"], ["firecrawl_parse", "Firecrawl parse"], ["browser_use", "Browser Use"], ["local_text", "Văn bản nội bộ"]]} />
						<FilterSelect label="Rủi ro" value={filters.risk ?? "all"} onChange={(value) => updateParam("risk", value)} options={[["all", "Mọi mức"], ["high", "Cao"], ["medium", "Trung bình"], ["low", "Thấp"]]} />
						<FilterSelect label="Cảm xúc" value={filters.sentiment ?? ""} onChange={(value) => updateParam("sentiment", value)} options={[["", "Mọi cảm xúc"], ["positive", "Tích cực"], ["neutral", "Trung tính"], ["negative", "Tiêu cực"]]} />
						<FilterSelect label="Lập trường" value={filters.stance ?? ""} onChange={(value) => updateParam("stance", value)} options={[["", "Mọi lập trường"], ["supportive", "Ủng hộ"], ["neutral", "Trung lập"], ["opposed", "Phản đối"]]} />
						<FilterSelect label="Trạng thái xử lý" value={filters.triageStatus ?? "all"} onChange={(value) => updateParam("triageStatus", value)} options={[["all", "Mọi trạng thái"], ["new", "Mới"], ["reviewing", "Đang xem xét"], ["action_required", "Cần hành động"], ["resolved", "Đã giải quyết"], ["dismissed", "Bỏ qua"]]} />
						<FilterSelect label="Phân công" value={filters.assignee ?? ""} onChange={(value) => updateParam("assignee", value)} options={[["", "Mọi người"], ["unassigned", "Chưa phân công"], ...knownAssignees(posts)]} />
						<FilterSelect label="Ghim đội ngũ" value={filters.isPinned === undefined ? "" : String(filters.isPinned)} onChange={(value) => updateParam("isPinned", value)} options={[["", "Tất cả"], ["true", "Đã ghim"], ["false", "Chưa ghim"]]} />
						<FilterSelect label="Hạn xử lý" value={filters.due ?? "all"} onChange={(value) => updateParam("due", value)} options={[["all", "Mọi hạn"], ["overdue", "Quá hạn"], ["today", "Hôm nay"], ["none", "Không có hạn"]]} />
						<label className="space-y-1"><span className={filterLabelClass}>Từ ngày</span><input type="date" value={filters.dateFrom ?? ""} onChange={(event) => updateParam("dateFrom", event.target.value)} className={inputClass} /></label>
						<label className="space-y-1"><span className={filterLabelClass}>Đến ngày</span><input type="date" value={filters.dateTo ?? ""} onChange={(event) => updateParam("dateTo", event.target.value)} className={inputClass} /></label>
						<label className="space-y-1"><span className={filterLabelClass}>Chủ đề</span><input value={filters.topic ?? ""} onChange={(event) => updateParam("topic", event.target.value)} placeholder="slug chủ đề" className={inputClass} /></label>
					</div>
				) : null}

				<div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3 text-xs">
					<span className="font-bold text-[var(--foreground)]">{total.toLocaleString("vi-VN")} kết quả</span>
					{activeFilters.map(([key, label]) => <button key={key} type="button" onClick={() => updateParam(key, "")} className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-bold text-[var(--accent-strong)]">{label} ×</button>)}
					{activeFilters.length ? <button type="button" onClick={clearFilters} className="font-bold text-[var(--danger-strong)]">Xóa tất cả</button> : null}
					{isPending ? <span className="text-[var(--muted)]">Đang cập nhật…</span> : null}
				</div>
			</div>

			{updatesAvailable ? (
				<button type="button" onClick={() => void refresh()} className="sticky top-32 z-10 mx-auto flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--accent-strong)] shadow-lg">
					<Sparkles size={14} /> Có bài viết hoặc cập nhật mới — tải khi bạn sẵn sàng
				</button>
			) : null}

			{timelineQuery.isError ? <ErrorState message={timelineQuery.error.message} onRetry={() => void timelineQuery.refetch()} /> : null}
			{!timelineQuery.isPending && !posts.length ? <EmptyState onClear={clearFilters} /> : null}
			{view === "list" ? (
				<TimelineDenseList posts={posts} onTriage={setSelectedId} />
			) : (
				<TimelineDayGroups posts={posts} onTriage={setSelectedId} currentTime={currentTime} />
			)}
			<div ref={sentinelRef} aria-hidden className="h-px" />
			{timelineQuery.hasNextPage ? (
				<div className="flex justify-center py-4"><button type="button" disabled={timelineQuery.isFetchingNextPage} onClick={() => void timelineQuery.fetchNextPage()} className={toolButtonClass}><RefreshCw size={14} className={timelineQuery.isFetchingNextPage ? "animate-spin" : ""} />{timelineQuery.isFetchingNextPage ? "Đang tải…" : "Tải thêm"}</button></div>
			) : posts.length ? <p className="py-4 text-center text-xs font-semibold text-[var(--muted)]">Đã hiển thị toàn bộ kết quả.</p> : null}

			{selectedPost ? (
				<EvidenceTriageSheet open post={selectedPost} onOpenChange={(open) => { if (!open) setSelectedId(null); }} onOptimisticUpdate={optimisticUpdate} />
			) : null}
		</div>
	);
}

function TimelineDayGroups({ posts, onTriage, currentTime }: { posts: TimelinePost[]; onTriage: (id: string) => void; currentTime: number }) {
	const groups = groupByVietnamDay(posts);
	return <div className="space-y-6">{groups.map(([day, items]) => <section key={day} aria-labelledby={`day-${day}`}><div className="sticky top-[168px] z-[5] mb-2 flex items-center gap-3 bg-[var(--background)]/90 py-2 backdrop-blur"><h2 id={`day-${day}`} className="text-sm font-extrabold text-[var(--foreground)]">{formatDay(day)}</h2><span className="h-px flex-1 bg-[var(--border)]" /><span className="text-xs font-semibold text-[var(--muted)]">{items.length} bài</span></div><div className="space-y-3">{items.map((post) => <TimelineCard key={post.id} post={post} onTriage={onTriage} currentTime={currentTime} />)}</div></section>)}</div>;
}

function TimelineCard({ post, onTriage, currentTime }: { post: TimelinePost; onTriage: (id: string) => void; currentTime: number }) {
	return (
		<article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]" style={{ contentVisibility: "auto", containIntrinsicSize: "260px" }}>
			<div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
				<div className="min-w-0"><p className="truncate text-sm font-extrabold text-[var(--foreground)]">{post.sourceLabel ?? post.author ?? intelligenceProviderLabel(post.provider)}</p><p className="mt-1 text-xs font-semibold text-[var(--muted)]">{post.author ? `${post.author} · ` : ""}{formatPublished(post.publishedAt ?? post.createdAt)}</p></div>
				<div className="flex flex-wrap items-center gap-2">{post.triage.isPinned ? <Badge icon={Pin} label="Đội ngũ ghim" accent /> : null}<TriageBadge status={post.triage.status} /><RiskPill risk={post.riskLevel} /></div>
			</div>
			<IntentPrefetchLink href={post.href} className="mt-4 block whitespace-pre-wrap text-[15px] font-semibold leading-7 text-[var(--foreground)] hover:text-[var(--accent-strong)]">{post.quote}</IntentPrefetchLink>
			{post.summary && post.summary !== post.quote ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{post.summary}</p> : null}
			<div className="mt-4 flex flex-wrap gap-2">{post.topicSlugs.map((slug) => <IntentPrefetchLink key={slug} href={`/topics/${slug}`} className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]">#{slug}</IntentPrefetchLink>)}<Badge label={sentimentLabel(post.sentiment)} /><Badge label={stanceLabel(post.stance)} /></div>
			<div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-wrap gap-3 text-xs font-semibold text-[var(--muted)]"><span>👍 {post.engagement.reactions.toLocaleString("vi-VN")}</span><span>💬 {post.engagement.comments.toLocaleString("vi-VN")}</span><span>↗ {post.engagement.shares.toLocaleString("vi-VN")}</span>{post.triage.assigneeDisplayName ? <span className="inline-flex items-center gap-1"><Users size={13} /> {post.triage.assigneeDisplayName}</span> : null}{post.triage.dueAt ? <DueBadge dueAt={post.triage.dueAt} status={post.triage.status} currentTime={currentTime} /> : null}</div>
				<div className="flex flex-wrap gap-3 text-xs font-bold"><button type="button" onClick={() => onTriage(post.id)} className="inline-flex items-center gap-1 text-[var(--accent-strong)]"><MessageSquareText size={14} /> Xử lý</button><IntentPrefetchLink href={post.scanHref} className="text-[var(--accent-strong)]">Mở scan</IntentPrefetchLink>{post.originalPostHref ? <a href={post.originalPostHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--accent-strong)]">Bài gốc <ExternalLink size={12} /></a> : null}</div>
			</div>
		</article>
	);
}

function TimelineDenseList({ posts, onTriage }: { posts: TimelinePost[]; onTriage: (id: string) => void }) {
	const parentRef = useRef<HTMLDivElement | null>(null);
	// eslint-disable-next-line react-hooks/incompatible-library
	const virtualizer = useVirtualizer({ count: posts.length, estimateSize: () => 118, getScrollElement: () => parentRef.current, overscan: 10 });
	return <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]"><div ref={parentRef} className="max-h-[720px] overflow-auto"><div className="relative" style={{ height: `${virtualizer.getTotalSize()}px` }}>{virtualizer.getVirtualItems().map((row) => { const post = posts[row.index]; if (!post) return null; return <div key={post.id} ref={virtualizer.measureElement} data-index={row.index} className="absolute left-0 top-0 w-full border-b border-[var(--border)]" style={{ transform: `translateY(${row.start}px)` }}><div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_150px_120px] sm:items-center"><div className="min-w-0"><IntentPrefetchLink href={post.href} className="line-clamp-2 text-sm font-bold text-[var(--foreground)]">{post.quote}</IntentPrefetchLink><p className="mt-1 truncate text-xs text-[var(--muted)]">{post.sourceLabel ?? post.author ?? intelligenceProviderLabel(post.provider)}</p></div><div className="text-xs font-semibold text-[var(--muted)]"><p>{formatIntelligenceDate(post.publishedAt ?? post.createdAt)}</p><p className="mt-1">{post.engagement.total.toLocaleString("vi-VN")} tương tác</p></div><button type="button" onClick={() => onTriage(post.id)} className="justify-self-start"><TriageBadge status={post.triage.status} /></button></div></div>; })}</div></div></div>;
}

function TriageBadge({ status }: { status: EvidenceTriageView["status"] }) { const accent = status === "action_required" || status === "reviewing"; return <span className={`inline-flex h-6 items-center rounded-md px-2 text-[11px] font-bold ${accent ? "bg-[var(--warning-soft)] text-[var(--warning-strong)]" : status === "resolved" ? "bg-[var(--success-soft)] text-[var(--success-strong)]" : "bg-[var(--neutral-soft)] text-[var(--muted-strong)]"}`}>{triageLabels[status]}</span>; }
function Badge({ accent = false, icon: Icon, label }: { accent?: boolean; icon?: typeof Pin; label: string }) { return <span className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-bold ${accent ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[var(--neutral-soft)] text-[var(--muted-strong)]"}`}>{Icon ? <Icon size={12} fill={accent ? "currentColor" : "none"} /> : null}{label}</span>; }
function DueBadge({ dueAt, status, currentTime }: { currentTime: number; dueAt: string; status: EvidenceTriageView["status"] }) { const overdue = new Date(dueAt).getTime() < currentTime && !["resolved", "dismissed"].includes(status); return <span className={overdue ? "font-bold text-[var(--danger-strong)]" : ""}>Hạn {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(dueAt))}{overdue ? " · Quá hạn" : ""}</span>; }

function FilterSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: [string, string][]; value: string }) { return <label className="space-y-1"><span className={filterLabelClass}>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{options.map(([key, text]) => <option key={key || "all"} value={key}>{text}</option>)}</select></label>; }
function ViewButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof List; label: string; onClick: () => void }) { return <button type="button" aria-pressed={active} onClick={onClick} className={`inline-flex items-center gap-1.5 rounded px-2.5 text-xs font-bold ${active ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"}`}><Icon size={14} />{label}</button>; }
function ToolButton({ active = false, icon: Icon, label, onClick, spinning = false }: { active?: boolean; icon: typeof Filter; label: string; onClick: () => void; spinning?: boolean }) { return <button type="button" onClick={onClick} className={`${toolButtonClass} ${active ? "border-[var(--accent)] text-[var(--accent-strong)]" : ""}`} title={label}><Icon size={15} className={spinning ? "animate-spin" : ""} /><span className="hidden sm:inline">{label}</span></button>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <div role="alert" className="rounded-lg border border-[var(--danger-strong)] bg-[var(--surface)] p-6 text-center"><p className="font-bold text-[var(--danger-strong)]">Không thể tải dòng thời gian</p><p className="mt-2 text-sm text-[var(--muted)]">{message}</p><button type="button" onClick={onRetry} className={`${toolButtonClass} mt-4`}><RefreshCw size={14} />Thử lại</button></div>; }
function EmptyState({ onClear }: { onClear: () => void }) { return <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center"><CalendarDays className="mx-auto text-[var(--muted)]" /><h2 className="mt-3 font-bold text-[var(--foreground)]">Không có bài viết phù hợp</h2><p className="mt-2 text-sm text-[var(--muted)]">Hãy nới bộ lọc hoặc xóa các điều kiện hiện tại.</p><button type="button" onClick={onClear} className={`${toolButtonClass} mt-4`}>Xóa bộ lọc</button></div>; }

function filtersFromParams(params: Readonly<URLSearchParams>): TimelineFilters { return { assignee: params.get("assignee") ?? undefined, dateFrom: params.get("dateFrom") ?? undefined, dateTo: params.get("dateTo") ?? undefined, due: (params.get("due") as TimelineFilters["due"]) ?? "all", facebookPage: params.get("facebookPage") ?? undefined, isPinned: params.has("isPinned") ? params.get("isPinned") === "true" : undefined, provider: params.get("provider") ?? undefined, query: params.get("q") ?? undefined, risk: (params.get("risk") as TimelineFilters["risk"]) ?? "all", sentiment: params.get("sentiment") ?? undefined, sort: (params.get("sort") as TimelineFilters["sort"]) ?? "published-desc", stance: params.get("stance") ?? undefined, timeRange: (params.get("timeRange") as TimelineFilters["timeRange"]) ?? "all", topic: params.get("topic") ?? undefined, triageStatus: (params.get("triageStatus") as TimelineFilters["triageStatus"]) ?? "all" }; }
function activeFilterEntries(filters: TimelineFilters): [string, string][] { const labels: [string, string | undefined][] = [["q", filters.query ? `Tìm: ${filters.query}` : undefined], ["timeRange", filters.timeRange !== "all" ? `Thời gian: ${filters.timeRange}` : undefined], ["facebookPage", filters.facebookPage ? "Fanpage" : undefined], ["provider", filters.provider ? intelligenceProviderLabel(filters.provider) : undefined], ["risk", filters.risk !== "all" ? `Rủi ro: ${filters.risk}` : undefined], ["sentiment", filters.sentiment ? `Cảm xúc: ${filters.sentiment}` : undefined], ["stance", filters.stance ? `Lập trường: ${filters.stance}` : undefined], ["triageStatus", filters.triageStatus !== "all" ? `Xử lý: ${filters.triageStatus}` : undefined], ["assignee", filters.assignee ? "Phân công" : undefined], ["isPinned", filters.isPinned !== undefined ? (filters.isPinned ? "Đã ghim" : "Chưa ghim") : undefined], ["due", filters.due !== "all" ? `Hạn: ${filters.due}` : undefined], ["dateFrom", filters.dateFrom ? `Từ ${filters.dateFrom}` : undefined], ["dateTo", filters.dateTo ? `Đến ${filters.dateTo}` : undefined], ["topic", filters.topic ? `#${filters.topic}` : undefined]]; return labels.filter((entry): entry is [string, string] => Boolean(entry[1])); }
function knownAssignees(posts: TimelinePost[]): [string, string][] { const map = new Map<string, string>(); for (const post of posts) if (post.triage.assigneeUserId) map.set(post.triage.assigneeUserId, post.triage.assigneeDisplayName ?? post.triage.assigneeUserId); return [...map]; }
function groupByVietnamDay(posts: TimelinePost[]) { const groups = new Map<string, TimelinePost[]>(); for (const post of posts) { const day = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh", year: "numeric" }).format(new Date(post.publishedAt ?? post.createdAt)); groups.set(day, [...(groups.get(day) ?? []), post]); } return [...groups]; }
function formatDay(day: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "full", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(`${day}T00:00:00+07:00`)); }
function formatPublished(value: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }
function sentimentLabel(value: string) { return ({ positive: "Tích cực", negative: "Tiêu cực", neutral: "Trung tính" } as Record<string, string>)[value] ?? value; }
function stanceLabel(value: string) { return ({ supportive: "Ủng hộ", opposed: "Phản đối", neutral: "Trung lập" } as Record<string, string>)[value] ?? value; }

const inputClass = "h-10 w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]";
const filterLabelClass = "block text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]";
const toolButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)] disabled:opacity-50";
