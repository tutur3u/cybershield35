"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowDownAZ,
	CalendarClock,
	EyeOff,
	FileDown,
	FileEdit,
	Loader,
	LoaderCircle,
	Newspaper,
	Plus,
	Search,
	Send,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { SafeImage } from "@/components/dashboard/safe-image";
import {
	DashboardTooltip,
	ReviewBadge,
} from "@/components/dashboard/ui-primitives";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	articleCatalogInfiniteQueryOptions,
	articleQueryKeys,
	fetchArticleJson,
	type ArticleCatalogPage,
	type ArticleListFilters,
} from "@/lib/articles/client-queries";

type RemoteArticle = ArticleCatalogPage["zaloArticles"][number];

export function ArticlesWorkspace() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim());
	const [review, setReview] = useState("all");
	const [state, setState] = useState("all");
	const [sort, setSort] = useState<ArticleListFilters["sort"]>("updated_desc");
	const [importOpen, setImportOpen] = useState(false);
	const filters = useMemo<ArticleListFilters>(
		() => ({ q: deferredSearch || undefined, review, sort, state }),
		[deferredSearch, review, sort, state],
	);
	const articlesQuery = useInfiniteQuery(articleCatalogInfiniteQueryOptions("local", 12, filters));
	const articles = articlesQuery.data?.pages.flatMap((page) => page.articles) ?? [];
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const fetchNextPage = articlesQuery.fetchNextPage;
	const hasNextPage = articlesQuery.hasNextPage;
	const isFetchingNextPage = articlesQuery.isFetchingNextPage;

	useEffect(() => {
		const node = loadMoreRef.current;
		if (!node || !hasNextPage || isFetchingNextPage) return;
		const observer = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting) void fetchNextPage();
		}, { rootMargin: "300px" });
		observer.observe(node);
		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)] xl:flex-row xl:items-center">
				<label className="relative min-w-0 flex-1">
					<Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
					<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tiêu đề, mô tả hoặc tác giả…" className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] pl-9 pr-3 text-[12px] font-semibold outline-none focus:border-[var(--accent)]" />
				</label>
				<Filter value={review} onChange={setReview} label="Trạng thái duyệt" options={[["all", "Mọi trạng thái"], ["needs_review", "Cần duyệt"], ["approved", "Đã duyệt"], ["rejected", "Từ chối"], ["draft", "Bản nháp"]]} />
				<Filter value={state} onChange={setState} label="Trạng thái đăng" options={[["all", "Tất cả"], ["draft", "Chưa đăng"], ["published", "Đã đăng"], ["archived", "Đã lưu trữ"]]} />
				<Filter value={sort ?? "updated_desc"} onChange={(value) => setSort(value as ArticleListFilters["sort"])} label="Sắp xếp" options={[["updated_desc", "Mới cập nhật"], ["updated_asc", "Cũ cập nhật"], ["title", "Theo tiêu đề"]]} icon />
				<button type="button" onClick={() => setImportOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 text-[11px] font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"><FileDown size={14} /> Nhập từ Zalo</button>
				<Link href="/articles/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-[11px] font-bold text-white"><Plus size={14} /> Bài viết mới</Link>
			</div>

			<div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
				<div className="grid grid-cols-[minmax(0,1fr)_110px_110px] gap-3 border-b border-[var(--border)] px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
					<span>Bài viết</span><span>Duyệt</span><span>Trên Zalo OA</span>
				</div>
				{articles.map(({ article }) => (
					<Link key={article.id} href={`/articles/${article.id}`} className="grid grid-cols-[minmax(0,1fr)_110px_110px] items-center gap-3 border-b border-[var(--divider)] px-4 py-3 transition last:border-b-0 hover:bg-[var(--surface-soft)]">
						<div className="flex min-w-0 items-center gap-3">
							<SafeImage
								alt=""
								className="h-12 w-16 shrink-0 rounded-md object-cover"
								fallback={
									<span className="grid h-12 w-16 shrink-0 place-items-center rounded-md bg-[var(--surface-soft)] text-[var(--muted)]">
										<Newspaper size={18} />
									</span>
								}
								height={64}
								src={article.coverUrl}
								width={96}
							/>
							<span className="min-w-0"><strong className="block truncate text-[12px] text-[var(--foreground)]">{article.title || "Bài viết chưa đặt tên"}</strong><span className="mt-1 block truncate text-[10px] font-semibold text-[var(--muted)]">{article.description || "Chưa có trích yếu"}</span><span className="mt-1 block text-[9px] text-[var(--muted)]">Cập nhật {formatDate(article.updatedAt)}</span></span>
						</div>
						<ReviewBadge status={article.reviewStatus} />
						<ZaloStatusBadge
							reason={article.lastError}
							status={article.publicationStatus}
						/>
					</Link>
				))}
				{articlesQuery.isPending ? <div className="grid min-h-40 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div> : null}
				{articlesQuery.isError ? <div className="p-8 text-center text-[12px] font-semibold text-[var(--danger-strong)]">{articlesQuery.error.message}</div> : null}
				{!articles.length && !articlesQuery.isPending ? <div className="p-10 text-center text-[12px] font-semibold text-[var(--muted)]">Không có bài viết phù hợp bộ lọc.</div> : null}
			</div>
			<div ref={loadMoreRef} className="h-1" />
			{articlesQuery.isFetchingNextPage ? <p className="text-center text-[11px] font-semibold text-[var(--muted)]">Đang tải thêm…</p> : null}
			<ImportZaloDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={async () => { await queryClient.invalidateQueries({ queryKey: articleQueryKeys.all }); setImportOpen(false); }} />
		</div>
	);
}

function ImportZaloDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => Promise<void> }) {
	const remoteQuery = useInfiniteQuery({ ...articleCatalogInfiniteQueryOptions("zalo", 10), enabled: open });
	const [notice, setNotice] = useState("");
	const mutation = useMutation({
		mutationFn: (remoteArticleId: string) => fetchArticleJson<{ imported: boolean }>("/api/articles/import-zalo", { body: JSON.stringify({ remoteArticleId }), headers: { "Content-Type": "application/json" }, method: "POST" }),
		onError: (error) => setNotice(error.message),
		onSuccess: async () => { setNotice("Đã nhập bài viết vào CS35 để biên tập và duyệt."); await onImported(); },
	});
	const remote = remoteQuery.data?.pages.flatMap((page) => page.zaloArticles) ?? [];
	return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}><DialogContent className="max-h-[80vh] overflow-y-auto border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"><DialogHeader><DialogTitle>Nhập từ Zalo OA</DialogTitle><DialogDescription>Chọn một bài để tạo bản nháp CS35. Bài nhập vẫn cần phê duyệt trước lần đồng bộ tiếp theo.</DialogDescription></DialogHeader><div className="space-y-2">{remote.map((item: RemoteArticle) => <button key={item.remoteArticleId} type="button" disabled={mutation.isPending} onClick={() => mutation.mutate(item.remoteArticleId)} className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3 text-left hover:bg-[var(--surface-soft)] disabled:opacity-60"><span className="min-w-0"><strong className="block truncate text-[12px]">{item.title}</strong><span className="mt-1 block truncate text-[10px] text-[var(--muted)]">{item.oaDisplayName}</span></span><FileDown size={14} className="shrink-0" /></button>)}{remoteQuery.isPending ? <LoaderCircle className="mx-auto animate-spin" /> : null}{!remote.length && !remoteQuery.isPending ? <p className="py-8 text-center text-[11px] text-[var(--muted)]">Không có bài viết Zalo để nhập.</p> : null}{notice ? <p className="text-[11px] font-semibold text-[var(--muted-strong)]">{notice}</p> : null}</div></DialogContent></Dialog>;
}

function Filter({ icon, label, onChange, options, value }: { icon?: boolean; label: string; onChange: (value: string) => void; options: Array<[string, string]>; value: string }) {
	return <label className="relative"><span className="sr-only">{label}</span>{icon ? <ArrowDownAZ size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /> : null}<select value={value} onChange={(event) => onChange(event.target.value)} className={`h-10 min-w-36 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] pr-7 text-[11px] font-bold outline-none focus:border-[var(--accent)] ${icon ? "pl-8" : "pl-3"}`}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

/** Reflects where the article stands on the Zalo Official Account. */
function ZaloStatusBadge({
	reason,
	status,
}: {
	/** Why the last attempt failed. A red badge with no reason tells an editor
	 * something is broken without telling them what to do about it. */
	reason?: string | null;
	status: string;
}) {
	const config: Record<string, { className: string; icon: typeof Send; label: string }> = {
		failed: {
			className: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
			icon: AlertTriangle,
			label: "Đăng lỗi",
		},
		hidden: {
			className: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
			icon: EyeOff,
			label: "Ẩn trên Zalo",
		},
		not_synced: {
			className: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]",
			icon: FileEdit,
			label: "Chưa đăng",
		},
		published: {
			className: "bg-[var(--success-soft)] text-[var(--success-strong)]",
			icon: Send,
			label: "Đang hiển thị",
		},
		publishing: {
			className: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
			icon: Loader,
			label: "Đang đăng",
		},
		scheduled: {
			className: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
			icon: CalendarClock,
			label: "Đã hẹn giờ",
		},
		syncing: {
			className: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
			icon: Loader,
			label: "Đang đưa lên",
		},
	};
	const entry = config[status] ?? config.not_synced!;
	const Icon = entry.icon;
	const badge = (
		<span
			className={`inline-flex h-6 max-w-full shrink-0 items-center justify-center gap-1 rounded-md px-2.5 text-[11px] font-bold leading-none whitespace-nowrap ${entry.className}`}
		>
			<Icon size={11} />
			{entry.label}
		</span>
	);
	const detail = status === "failed" ? reason?.trim() : null;
	if (!detail) return badge;
	return <DashboardTooltip content={detail}>{badge}</DashboardTooltip>;
}
function formatDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
