"use client";

import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	ArrowDown,
	ArrowDownAZ,
	ArrowRight,
	ArrowUp,
	CalendarClock,
	CheckSquare2,
	CloudUpload,
	Eye,
	FilePlus2,
	Heart,
	LoaderCircle,
	MessageCircle,
	Newspaper,
	Radio,
	Search,
	Settings2,
	Share2,
	ShieldCheck,
	Trash2,
	X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { Panel, PanelHeader } from "@/components/dashboard/ui-primitives";
import { DashboardTooltip } from "@/components/dashboard/ui-primitives";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	articleCatalogInfiniteQueryOptions,
	articleQueryKeys,
	articleSettingsQueryOptions,
	fetchArticleJson,
	type ArticleCatalogPage,
	type ArticleSettings,
	type LocalArticleListItem,
} from "@/lib/articles/client-queries";
import type { ZaloCatalogArticle } from "@/lib/zalo/article-catalog";

type ArticleCatalogData = {
	articles: LocalArticleListItem[];
	zaloArticles: ZaloCatalogArticle[];
	zaloIssues: Array<{ message: string; oaDisplayName: string }>;
};

type CatalogArticle = {
	articleId: string | null;
	coverUrl: string | null;
	date: string;
	description: string;
	href: string;
	id: string;
	metrics: ZaloCatalogArticle["metrics"] | null;
	oaDisplayName: string;
	origin: "cs35" | "zalo";
	publicationStatus: string;
	reviewStatus: string | null;
	scheduledAt: string | null;
	title: string;
};

type SortMode = "title" | "updated_asc" | "updated_desc";
type ReviewStatus = "approved" | "draft" | "needs_review" | "rejected";
const ZALO_OA_MANAGER_URL = "https://oa.zalo.me/manage/content/article/";

export function ArticlesWorkspace() {
	const localQuery = useInfiniteQuery(
		articleCatalogInfiniteQueryOptions("local"),
	);
	const zaloQuery = useInfiniteQuery(
		articleCatalogInfiniteQueryOptions("zalo"),
	);
	const settings = useQuery(articleSettingsQueryOptions());
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [source, setSource] = useState<"all" | "cs35" | "zalo">("all");
	const [status, setStatus] = useState("all");
	const [oa, setOa] = useState("all");
	const [sort, setSort] = useState<SortMode>("updated_desc");
	const [selected, setSelected] = useState<Set<string>>(() => new Set());
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [bulkReviewStatus, setBulkReviewStatus] =
		useState<ReviewStatus>("needs_review");
	const [notice, setNotice] = useState<string | null>(null);
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase("vi"));
	const catalogData = useMemo(
		() =>
			mergeArticlePages([
				...(localQuery.data?.pages ?? []),
				...(zaloQuery.data?.pages ?? []),
			]),
		[localQuery.data?.pages, zaloQuery.data?.pages],
	);

	const catalog = useMemo(
		() => buildCatalog(catalogData),
		[catalogData],
	);
	const oaOptions = useMemo(
		() =>
			Array.from(
				new Set(catalog.map((article) => article.oaDisplayName)),
			).sort((left, right) => left.localeCompare(right, "vi")),
		[catalog],
	);
	const statusOptions = useMemo(
		() => Array.from(new Set(catalog.map((article) => article.publicationStatus))),
		[catalog],
	);
	const visibleArticles = useMemo(() => {
		const filtered = catalog.filter((article) => {
			if (source !== "all" && article.origin !== source) return false;
			if (status !== "all" && article.publicationStatus !== status) return false;
			if (oa !== "all" && article.oaDisplayName !== oa) return false;
			if (!deferredSearch) return true;
			return `${article.title} ${article.description} ${article.oaDisplayName}`
				.toLocaleLowerCase("vi")
				.includes(deferredSearch);
		});
		return filtered.toSorted((left, right) => {
			if (sort === "title") return left.title.localeCompare(right.title, "vi");
			const comparison =
				new Date(left.date).getTime() - new Date(right.date).getTime();
			return sort === "updated_asc" ? comparison : -comparison;
		});
	}, [catalog, deferredSearch, oa, sort, source, status]);
	const filtersActive =
		Boolean(search) || source !== "all" || status !== "all" || oa !== "all";
	const visibleCs35Ids = visibleArticles.flatMap((article) =>
		article.articleId ? [article.articleId] : [],
	);
	const selectedIds = [...selected].filter((id) =>
		catalog.some((article) => article.articleId === id),
	);
	const allVisibleSelected =
		visibleCs35Ids.length > 0 &&
		visibleCs35Ids.every((id) => selected.has(id));
	const bulkMutation = useMutation({
		mutationKey: [...articleQueryKeys.all, "bulk"],
		mutationFn: (input: {
			action: "delete" | "hide" | "set_review_status" | "sync_hidden";
			articleIds: string[];
			status?: ReviewStatus;
		}) =>
			postJson<{ failed: number; succeeded: number }>(
				"/api/articles/bulk",
				input,
			),
	});
	const bulkBusy = bulkMutation.isPending
		? bulkMutation.variables?.action
		: null;
	const {
		fetchNextPage: fetchNextLocalPage,
		hasNextPage: hasNextLocalPage,
		isFetchingNextPage: isFetchingNextLocalPage,
	} = localQuery;
	const {
		fetchNextPage: fetchNextZaloPage,
		hasNextPage: hasNextZaloPage,
		isFetchingNextPage: isFetchingNextZaloPage,
	} = zaloQuery;
	const hasNextPage = hasNextLocalPage || hasNextZaloPage;
	const isFetchingNextPage =
		isFetchingNextLocalPage || isFetchingNextZaloPage;
	const catalogPending =
		catalog.length === 0 && (localQuery.isPending || zaloQuery.isPending);
	const catalogError = localQuery.error ?? zaloQuery.error;
	const catalogFailed =
		catalog.length === 0 && localQuery.isError && zaloQuery.isError;
	const fetchNextPages = () => {
		if (hasNextLocalPage && !isFetchingNextLocalPage) {
			void fetchNextLocalPage();
		}
		if (hasNextZaloPage && !isFetchingNextZaloPage) {
			void fetchNextZaloPage();
		}
	};

	useEffect(() => {
		const node = loadMoreRef.current;
		if (!node || !hasNextPage || isFetchingNextPage) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return;
				if (hasNextLocalPage) void fetchNextLocalPage();
				if (hasNextZaloPage) void fetchNextZaloPage();
			},
			{ rootMargin: "400px 0px" },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [
		hasNextPage,
		isFetchingNextPage,
		fetchNextLocalPage,
		fetchNextZaloPage,
		hasNextLocalPage,
		hasNextZaloPage,
	]);

	async function runBulk(
		action: "delete" | "hide" | "set_review_status" | "sync_hidden",
		status?: ReviewStatus,
	) {
		if (!selectedIds.length) return;
		setNotice(null);
		try {
			const result = await bulkMutation.mutateAsync({
				action,
				articleIds: selectedIds,
				...(action === "set_review_status" ? { status } : {}),
			});
			setNotice(
				result.failed
					? `Đã xử lý ${result.succeeded} bài; ${result.failed} bài cần kiểm tra lại.`
					: `Đã xử lý ${result.succeeded} bài viết.`,
			);
			setSelected(new Set());
			setDeleteOpen(false);
			await queryClient.invalidateQueries({ queryKey: articleQueryKeys.all });
		} catch (error) {
			setNotice(
				error instanceof Error ? error.message : "Không thể xử lý bài viết.",
			);
		}
	}

	return (
		<Panel>
			<PanelHeader
				title="Không gian bài viết"
				description="Một danh sách thống nhất cho bài tạo trên CS35 và nội dung hiện có trên các Zalo OA đã kết nối."
				action={
					<div className="flex items-center gap-2">
						<DashboardTooltip content="Cài đặt đồng bộ bản nháp tự động và trạng thái Zalo mặc định.">
							<button
								type="button"
								onClick={() => setSettingsOpen(true)}
								className="grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
								aria-label="Cài đặt bài viết"
							>
								<Settings2 size={14} />
							</button>
						</DashboardTooltip>
						<Link
							href="/articles/new"
							className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--brand)] px-3 text-[11px] font-bold text-white"
						>
							<FilePlus2 size={14} />
							Bài viết mới
						</Link>
					</div>
				}
			/>
			<div className="border-b border-[var(--border)] p-3">
				<div className="flex flex-col gap-2 xl:flex-row xl:items-center">
					<label className="relative min-w-0 flex-1 xl:max-w-sm">
						<Search
							size={14}
							className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
						/>
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Tìm tiêu đề, mô tả hoặc Zalo OA…"
							className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-[11px] outline-none transition focus:border-[var(--brand)]"
						/>
					</label>
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<div
							className="inline-flex h-9 rounded-md border border-[var(--border)] bg-[var(--surface-soft)] p-1"
							aria-label="Lọc theo nguồn tạo bài"
						>
							{[
								["all", "Tất cả", "Hiển thị cả bài CS35 và bài chỉ có trên Zalo."],
								["cs35", "CS35", "Chỉ hiển thị bài được tạo trên CyberShield35."],
								["zalo", "Zalo", "Chỉ hiển thị bài có nguồn gốc từ Zalo OA."],
							].map(([value, label, help]) => (
								<DashboardTooltip key={value} content={help}>
									<button
										type="button"
										aria-pressed={source === value}
										onClick={() => setSource(value as typeof source)}
										className={`rounded px-2.5 text-[10px] font-bold transition ${
											source === value
												? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
												: "text-[var(--muted)] hover:text-[var(--foreground)]"
										}`}
									>
										{label}
									</button>
								</DashboardTooltip>
							))}
						</div>
						<select
							value={status}
							onChange={(event) => setStatus(event.target.value)}
							aria-label="Lọc theo trạng thái"
							className="h-9 max-w-40 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-[10px] font-bold outline-none"
						>
							<option value="all">Mọi trạng thái</option>
							{statusOptions.map((value) => (
								<option key={value} value={value}>
									{publicationLabel(value)}
								</option>
							))}
						</select>
						<select
							value={oa}
							onChange={(event) => setOa(event.target.value)}
							aria-label="Lọc theo Zalo OA"
							className="h-9 max-w-48 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-[10px] font-bold outline-none"
						>
							<option value="all">Mọi Zalo OA</option>
							{oaOptions.map((value) => (
								<option key={value} value={value}>
									{value}
								</option>
							))}
						</select>
						<div className="inline-flex h-9 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] p-1">
							<SortButton
								active={sort === "updated_desc"}
								label="Mới cập nhật trước"
								onClick={() => setSort("updated_desc")}
								icon={ArrowDown}
							/>
							<SortButton
								active={sort === "updated_asc"}
								label="Cũ cập nhật trước"
								onClick={() => setSort("updated_asc")}
								icon={ArrowUp}
							/>
							<SortButton
								active={sort === "title"}
								label="Sắp xếp theo tiêu đề"
								onClick={() => setSort("title")}
								icon={ArrowDownAZ}
							/>
						</div>
						{filtersActive ? (
							<DashboardTooltip content="Xóa tìm kiếm và tất cả bộ lọc.">
								<button
									type="button"
									onClick={() => {
										setSearch("");
										setSource("all");
										setStatus("all");
										setOa("all");
									}}
									aria-label="Xóa bộ lọc"
									className="grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
								>
									<X size={14} />
								</button>
							</DashboardTooltip>
						) : null}
					</div>
				</div>
				<div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--muted)]">
					<Badge
						variant="secondary"
						className="h-5 rounded px-1.5 text-[9px]"
					>
						{visibleArticles.length} đang hiển thị · {catalog.length} đã tải
					</Badge>
					{zaloQuery.isPending ? (
						<Badge
							variant="outline"
							className="h-5 gap-1 border-[#0068ff]/30 bg-[#0068ff]/10 px-1.5 text-[9px] text-[#5b9aff]"
						>
							<LoaderCircle size={9} className="animate-spin" /> Đang tải bài Zalo
						</Badge>
					) : null}
					{catalogData?.zaloIssues.length ? (
						<DashboardTooltip
							content={
								<div className="space-y-1">
									{catalogData.zaloIssues.map((issue) => (
										<p key={`${issue.oaDisplayName}:${issue.message}`}>
											{issue.oaDisplayName}: {issue.message}
										</p>
									))}
								</div>
							}
						>
							<Badge
								variant="outline"
								className="h-5 border-[var(--warning-border)] bg-[var(--warning-soft)] px-1.5 text-[9px] text-[var(--warning-strong)]"
							>
								{catalogData.zaloIssues.length} OA cần làm mới
							</Badge>
						</DashboardTooltip>
					) : null}
					<a
						href={ZALO_OA_MANAGER_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border)] px-2 text-[10px] font-bold text-[var(--muted-strong)] transition hover:border-[#0068ff]/60 hover:text-[#5b9aff]"
					>
						<Radio size={11} /> Mở Nội dung Zalo OA
					</a>
				</div>
			</div>
			{selectedIds.length ? (
				<div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--accent-soft)] px-3 py-2">
					<Badge className="h-6 bg-[var(--brand)] text-[10px] text-white">
						<CheckSquare2 size={11} /> {selectedIds.length} bài CS35
					</Badge>
					<select
						value={bulkReviewStatus}
						onChange={(event) =>
							setBulkReviewStatus(event.target.value as ReviewStatus)
						}
						aria-label="Trạng thái duyệt hàng loạt"
						className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[10px] font-bold"
					>
						<option value="draft">Bản nháp</option>
						<option value="needs_review">Cần duyệt</option>
						<option value="approved">Đã duyệt</option>
						<option value="rejected">Đã từ chối</option>
					</select>
					<button
						type="button"
						disabled={Boolean(bulkBusy)}
						onClick={() =>
							void runBulk("set_review_status", bulkReviewStatus)
						}
						className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[10px] font-bold disabled:opacity-50"
					>
						{bulkBusy === "set_review_status" ? (
							<LoaderCircle size={12} className="animate-spin" />
						) : (
							<CheckSquare2 size={12} />
						)}
						Đổi trạng thái
					</button>
					<DashboardTooltip content="Tạo hoặc cập nhật các bài đã chọn thành bản nháp ẩn trên Zalo. Không xuất bản công khai.">
						<button
							type="button"
							disabled={Boolean(bulkBusy)}
							onClick={() => void runBulk("sync_hidden")}
							className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[10px] font-bold disabled:opacity-50"
						>
							<CloudUpload size={12} /> Đồng bộ bản nháp ẩn
						</button>
					</DashboardTooltip>
					<button
						type="button"
						disabled={Boolean(bulkBusy)}
						onClick={() => void runBulk("hide")}
						className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[10px] font-bold disabled:opacity-50"
					>
						<Eye size={12} /> Chuyển về ẩn
					</button>
					<button
						type="button"
						disabled={Boolean(bulkBusy)}
						onClick={() => setDeleteOpen(true)}
						className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--danger-border)] bg-[var(--danger-soft)] px-2.5 text-[10px] font-bold text-[var(--danger-strong)] disabled:opacity-50"
					>
						<Trash2 size={12} /> Xóa
					</button>
					<button
						type="button"
						onClick={() => setSelected(new Set())}
						className="ml-auto grid size-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface)]"
						aria-label="Bỏ chọn tất cả"
					>
						<X size={13} />
					</button>
				</div>
			) : null}
			{notice ? (
				<div className="border-b border-[var(--border)] px-3 py-2 text-[11px] font-semibold text-[var(--muted-strong)]">
					{notice}
				</div>
			) : null}
			<div className="p-3">
				{catalogPending ? (
					<div className="space-y-2">
						{Array.from({ length: 7 }).map((_, index) => (
							<div
								key={index}
								className="h-[92px] animate-pulse rounded-lg bg-[var(--surface-soft)]"
							/>
						))}
					</div>
				) : catalogFailed ? (
					<div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger-strong)]">
						{catalogError instanceof Error
							? catalogError.message
							: "Không thể tải danh sách bài viết."}
					</div>
				) : catalog.length === 0 ? (
					<EmptyArticles />
				) : visibleArticles.length === 0 ? (
					<div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-6 text-center">
						<div>
							<Search
								size={24}
								className="mx-auto text-[var(--muted)]"
							/>
							<p className="mt-3 text-sm font-bold">Không có bài phù hợp</p>
							<p className="mt-1 text-[11px] text-[var(--muted)]">
								Thử từ khóa khác hoặc xóa bớt bộ lọc.
							</p>
						</div>
					</div>
				) : (
					<div className="space-y-2">
						<label className="flex w-fit items-center gap-2 px-1 py-1 text-[10px] font-bold text-[var(--muted-strong)]">
							<input
								type="checkbox"
								checked={allVisibleSelected}
								onChange={() =>
									setSelected((current) => {
										const next = new Set(current);
										for (const id of visibleCs35Ids) {
											if (allVisibleSelected) next.delete(id);
											else next.add(id);
										}
										return next;
									})
								}
							/>
							Chọn tất cả bài CS35 đang hiển thị
						</label>
						{visibleArticles.map((article) => (
							<ArticleCatalogRow
								key={article.id}
								article={article}
								selected={
									article.articleId
										? selected.has(article.articleId)
										: false
								}
								onSelect={(checked) => {
									if (!article.articleId) return;
									setSelected((current) => {
										const next = new Set(current);
										if (checked) next.add(article.articleId!);
										else next.delete(article.articleId!);
										return next;
									});
								}}
							/>
						))}
					</div>
				)}
				{!catalogPending && !catalogFailed && hasNextPage ? (
					<div
						ref={loadMoreRef}
						className="mt-3 flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-3"
					>
						<button
							type="button"
							disabled={isFetchingNextPage}
							onClick={fetchNextPages}
							className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[10px] font-bold transition hover:border-[var(--brand)] disabled:opacity-60"
						>
							{isFetchingNextPage ? (
								<LoaderCircle size={12} className="animate-spin" />
							) : (
								<ArrowDown size={12} />
							)}
							{isFetchingNextPage
								? "Đang tải thêm…"
								: "Tải thêm bài viết"}
						</button>
						<p className="text-[9px] text-[var(--muted)]">
							Cuộn xuống để tự động tải tiếp. Danh sách đã tải được giữ trong bộ nhớ đệm.
						</p>
					</div>
				) : !catalogPending && !catalogFailed && catalog.length > 0 ? (
					<p className="mt-3 text-center text-[9px] text-[var(--muted)]">
						Đã tải toàn bộ {catalog.length} bài viết.
					</p>
				) : null}
			</div>
			<ArticleSettingsDialog
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				settings={settings.data}
				pending={settings.isPending}
				onSaved={async () => {
					await queryClient.invalidateQueries({
						queryKey: articleQueryKeys.settings(),
					});
				}}
			/>
			<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Xóa {selectedIds.length} bài viết?</DialogTitle>
						<DialogDescription>
							Bài do CS35 tạo sẽ bị xóa khỏi CS35. Nếu đã đồng bộ, bản
							nháp hoặc bài đăng tương ứng cũng bị xóa khỏi Zalo OA. Thao
							tác này không thể hoàn tác.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<button
								type="button"
								className="h-9 rounded-md border border-[var(--border)] px-3 text-[11px] font-bold"
							>
								Hủy
							</button>
						</DialogClose>
						<button
							type="button"
							onClick={() => void runBulk("delete")}
							disabled={bulkBusy === "delete"}
							className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--danger)] px-3 text-[11px] font-bold text-white disabled:opacity-50"
						>
							{bulkBusy === "delete" ? (
								<LoaderCircle size={13} className="animate-spin" />
							) : (
								<Trash2 size={13} />
							)}
							Xóa khỏi CS35 và Zalo
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Panel>
	);
}

function ArticleSettingsDialog({
	onOpenChange,
	onSaved,
	open,
	pending,
	settings,
}: {
	onOpenChange: (open: boolean) => void;
	onSaved: () => Promise<void>;
	open: boolean;
	pending: boolean;
	settings: ArticleSettings | undefined;
}) {
	const [autoSyncDrafts, setAutoSyncDrafts] = useState(
		settings?.autoSyncDrafts ?? true,
	);
	const currentAutoSync = settings?.autoSyncDrafts ?? true;
	const saveMutation = useMutation({
		mutationKey: [...articleQueryKeys.settings(), "update"],
		mutationFn: (nextAutoSyncDrafts: boolean) =>
			patchJson("/api/articles/settings", {
				autoSyncDrafts: nextAutoSyncDrafts,
			}),
		onSuccess: async () => {
			await onSaved();
			onOpenChange(false);
		},
	});
	const error =
		saveMutation.error instanceof Error
			? saveMutation.error.message
			: saveMutation.error
				? "Không thể lưu cài đặt."
				: null;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (nextOpen) setAutoSyncDrafts(currentAutoSync);
				if (!nextOpen) saveMutation.reset();
				onOpenChange(nextOpen);
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Cài đặt bản nháp Zalo OA</DialogTitle>
					<DialogDescription>
						Kiểm soát cách bài viết tự động từ scan được chuyển sang Zalo.
						Mọi bài tự động luôn ở trạng thái ẩn và không được xuất bản công
						khai.
					</DialogDescription>
				</DialogHeader>
				{pending ? (
					<div className="h-24 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
				) : (
					<div className="space-y-3">
						<label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
							<span>
								<span className="block text-[12px] font-bold">
									Tự động đồng bộ bản nháp
								</span>
								<span className="mt-1 block text-[10px] leading-4 text-[var(--muted)]">
									Bài tạo tự động từ scan sẽ được gửi tới{" "}
									{settings?.defaultOa?.displayName ??
										"Zalo OA mặc định"}{" "}
									để duyệt.
								</span>
							</span>
							<input
								type="checkbox"
								role="switch"
								checked={autoSyncDrafts}
								onChange={(event) =>
									setAutoSyncDrafts(event.target.checked)
								}
								className="mt-1"
							/>
						</label>
						<div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--success-border)] bg-[var(--success-soft)] p-3">
							<div>
								<p className="text-[11px] font-bold text-[var(--success-strong)]">
									Trạng thái mặc định
								</p>
								<p className="mt-1 text-[10px] text-[var(--muted-strong)]">
									Chỉ người quản trị OA nhìn thấy cho đến khi duyệt.
								</p>
							</div>
							<Badge
								variant="outline"
								className="border-[var(--success-border)] bg-[var(--surface)] text-[10px] text-[var(--success-strong)]"
							>
								Bản nháp ẩn · chưa đăng
							</Badge>
						</div>
						{error ? (
							<p className="rounded-md bg-[var(--danger-soft)] p-2 text-[10px] font-semibold text-[var(--danger-strong)]">
								{error}
							</p>
						) : null}
					</div>
				)}
				<DialogFooter>
					<DialogClose asChild>
						<button
							type="button"
							className="h-9 rounded-md border border-[var(--border)] px-3 text-[11px] font-bold"
						>
							Hủy
						</button>
					</DialogClose>
					<button
						type="button"
						disabled={saveMutation.isPending || pending || !settings?.defaultOa}
						onClick={() => saveMutation.mutate(autoSyncDrafts)}
						className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--brand)] px-3 text-[11px] font-bold text-white disabled:opacity-50"
					>
						{saveMutation.isPending ? (
							<LoaderCircle size={13} className="animate-spin" />
						) : null}
						Lưu cài đặt
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ArticleCatalogRow({
	article,
	onSelect,
	selected,
}: {
	article: CatalogArticle;
	onSelect: (checked: boolean) => void;
	selected: boolean;
}) {
	const body = (
		<>
			<div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-md bg-[var(--surface-soft)] sm:w-32">
				{article.coverUrl ? (
					<Image
						unoptimized
						fill
						sizes="128px"
						src={article.coverUrl}
						alt=""
						className="object-cover"
					/>
				) : (
					<span className="grid size-full place-items-center text-[var(--muted)]">
						<Newspaper size={22} />
					</span>
				)}
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-1.5">
					<StatusBadge status={article.publicationStatus} />
					{article.reviewStatus ? (
						<Badge
							variant="outline"
							className={reviewBadgeClass(article.reviewStatus)}
						>
							{reviewLabel(article.reviewStatus)}
						</Badge>
					) : null}
					{article.origin === "cs35" ? (
						<DashboardTooltip content="Bài viết này được tạo và quản lý phiên bản trên CyberShield35.">
							<Badge
								variant="outline"
								className="h-5 border-[var(--success-border)] bg-[var(--success-soft)] px-1.5 text-[9px] text-[var(--success-strong)]"
							>
								<ShieldCheck size={10} /> Created on CS35
							</Badge>
						</DashboardTooltip>
					) : (
						<DashboardTooltip content="Bài viết có sẵn trên Zalo OA và chưa được tạo thành bản biên tập CS35.">
							<Badge
								variant="outline"
								className="h-5 border-[#0068ff]/35 bg-[#0068ff]/10 px-1.5 text-[9px] text-[#5b9aff]"
							>
								<Radio size={10} /> Zalo OA
							</Badge>
						</DashboardTooltip>
					)}
				</div>
				<h2 className="mt-2 line-clamp-1 text-[13px] font-bold leading-5 text-[var(--foreground)]">
					{article.title}
				</h2>
				<p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--muted)]">
					{article.description ||
						(article.origin === "cs35"
							? "Chưa có mô tả. Mở bài viết để tiếp tục biên tập."
							: "Zalo OA không cung cấp mô tả cho bài viết này.")}
				</p>
				<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-semibold text-[var(--muted)]">
					<span className="inline-flex items-center gap-1">
						<Radio size={10} /> {article.oaDisplayName}
					</span>
					<span className="inline-flex items-center gap-1">
						<CalendarClock size={10} /> {formatDate(article.date)}
					</span>
					{article.scheduledAt ? (
						<span className="inline-flex items-center gap-1 text-[var(--warning-strong)]">
							<CalendarClock size={10} /> Lịch {formatDate(article.scheduledAt)}
						</span>
					) : null}
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-3 self-stretch sm:ml-auto">
				{article.metrics && hasMetrics(article.metrics) ? (
					<div className="hidden grid-cols-4 gap-3 text-center lg:grid">
						<Metric icon={Eye} value={article.metrics.views} label="Lượt xem" />
						<Metric icon={Heart} value={article.metrics.likes} label="Lượt thích" />
						<Metric
							icon={MessageCircle}
							value={article.metrics.comments}
							label="Bình luận"
						/>
						<Metric icon={Share2} value={article.metrics.shares} label="Chia sẻ" />
					</div>
				) : null}
				<ArrowRight
					size={15}
					className="ml-auto text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand)]"
				/>
			</div>
		</>
	);
	const className =
		"group flex min-w-0 flex-1 flex-col gap-3 p-3 sm:flex-row sm:items-center";

	return (
		<div className="flex overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--brand)] hover:bg-[var(--surface-soft)]">
			{article.articleId ? (
				<label className="flex shrink-0 items-start border-r border-[var(--border)] px-3 py-4">
					<input
						type="checkbox"
						checked={selected}
						onChange={(event) => onSelect(event.target.checked)}
						aria-label={`Chọn ${article.title}`}
					/>
				</label>
			) : null}
			{article.origin === "cs35" ? (
				<Link href={article.href} className={className}>
					{body}
				</Link>
			) : (
				<a
					href={article.href}
					target="_blank"
					rel="noopener noreferrer"
					className={className}
					aria-label={`${article.title} · Mở trong Zalo OA Manager`}
				>
					{body}
				</a>
			)}
		</div>
	);
}

function Metric({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof Eye;
	label: string;
	value: number;
}) {
	return (
		<DashboardTooltip content={label}>
			<span className="min-w-9">
				<Icon size={11} className="mx-auto text-[var(--muted)]" />
				<span className="mt-1 block text-[9px] font-bold text-[var(--muted-strong)]">
					{compactNumber(value)}
				</span>
			</span>
		</DashboardTooltip>
	);
}

function SortButton({
	active,
	icon: Icon,
	label,
	onClick,
}: {
	active: boolean;
	icon: typeof ArrowDown;
	label: string;
	onClick: () => void;
}) {
	return (
		<DashboardTooltip content={label}>
			<button
				type="button"
				aria-label={label}
				aria-pressed={active}
				onClick={onClick}
				className={`grid size-7 place-items-center rounded text-[var(--muted)] transition ${
					active
						? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
						: "hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
				}`}
			>
				<Icon size={13} />
			</button>
		</DashboardTooltip>
	);
}

function StatusBadge({ status }: { status: string }) {
	return (
		<Badge variant="outline" className={statusClass(status)}>
			{publicationLabel(status)}
		</Badge>
	);
}

function EmptyArticles() {
	return (
		<div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-8 text-center">
			<div>
				<span className="mx-auto grid size-12 place-items-center rounded-xl bg-[var(--success-soft)] text-[var(--brand)]">
					<Newspaper size={23} />
				</span>
				<h2 className="mt-4 text-base font-bold">Chưa có bài viết</h2>
				<p className="mt-2 max-w-md text-[12px] leading-5 text-[var(--muted)]">
					Tạo bài viết từ đầu, hoặc yêu cầu Chat tạo một bài từ scan và bằng
					chứng đã lưu.
				</p>
				<Link
					href="/articles/new"
					className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-[var(--brand)] px-4 text-[11px] font-bold text-white"
				>
					<FilePlus2 size={14} /> Tạo bài đầu tiên
				</Link>
			</div>
		</div>
	);
}

function mergeArticlePages(
	pages: ArticleCatalogPage[] | undefined,
): ArticleCatalogData | undefined {
	if (!pages?.length) return undefined;
	const localArticles = new Map<string, LocalArticleListItem>();
	const remoteArticles = new Map<string, ZaloCatalogArticle>();
	const issues = new Map<
		string,
		{ message: string; oaDisplayName: string }
	>();
	for (const page of pages) {
		for (const item of page.articles) {
			localArticles.set(item.article.id, item);
		}
		for (const item of page.zaloArticles) {
			remoteArticles.set(
				`${item.oaConnectionId}:${item.remoteArticleId}`,
				item,
			);
		}
		for (const issue of page.zaloIssues) {
			issues.set(`${issue.oaDisplayName}:${issue.message}`, issue);
		}
	}
	return {
		articles: [...localArticles.values()],
		zaloArticles: [...remoteArticles.values()],
		zaloIssues: [...issues.values()],
	};
}

function buildCatalog(data: ArticleCatalogData | undefined): CatalogArticle[] {
	if (!data) return [];
	const remoteById = new Map(
		data.zaloArticles.map((article) => [article.remoteArticleId, article]),
	);
	const localRemoteIds = new Set(
		data.articles.flatMap(({ article }) =>
			article.remoteArticleId ? [article.remoteArticleId] : [],
		),
	);
	const local = data.articles.map(({ article, oaDisplayName }) => {
		const remote = article.remoteArticleId
			? remoteById.get(article.remoteArticleId)
			: undefined;
		return {
			articleId: article.id,
			coverUrl: article.coverUrl ?? remote?.coverUrl ?? null,
			date: article.updatedAt,
			description: article.description,
			href: `/articles/${article.id}`,
			id: `cs35:${article.id}`,
			metrics: remote?.metrics ?? null,
			oaDisplayName: oaDisplayName ?? "Chưa chọn Zalo OA",
			origin: "cs35" as const,
			publicationStatus: article.publicationStatus,
			reviewStatus: article.reviewStatus,
			scheduledAt: article.scheduledAt,
			title: article.title || "Bài viết chưa đặt tên",
		};
	});
	const remoteOnly = data.zaloArticles
		.filter((article) => !localRemoteIds.has(article.remoteArticleId))
		.map((article) => ({
			articleId: null,
			coverUrl: article.coverUrl,
			date:
				article.updatedAt ??
				article.publishedAt ??
				article.createdAt ??
				new Date(0).toISOString(),
			description: article.description,
			href: ZALO_OA_MANAGER_URL,
			id: `zalo:${article.oaConnectionId}:${article.remoteArticleId}`,
			metrics: article.metrics,
			oaDisplayName: article.oaDisplayName,
			origin: "zalo" as const,
			publicationStatus: article.publicationStatus,
			reviewStatus: null,
			scheduledAt: null,
			title: article.title,
		}));
	return [...local, ...remoteOnly];
}

async function postJson<T>(url: string, input: unknown): Promise<T> {
	return fetchArticleJson<T>(url, {
		body: JSON.stringify(input),
		headers: { "content-type": "application/json" },
		method: "POST",
	});
}

async function patchJson<T>(url: string, input: unknown): Promise<T> {
	return fetchArticleJson<T>(url, {
		body: JSON.stringify(input),
		headers: { "content-type": "application/json" },
		method: "PATCH",
	});
}

function publicationLabel(status: string) {
	const labels: Record<string, string> = {
		failed: "Cần xử lý",
		hidden: "Bản nháp Zalo · chưa đăng",
		not_synced: "Chưa đồng bộ",
		published: "Đã xuất bản",
		publishing: "Đang xuất bản",
		remote_draft: "Bản nháp Zalo",
		scheduled: "Đã lên lịch",
		syncing: "Đang đồng bộ",
	};
	return labels[status] ?? status;
}

function statusClass(status: string) {
	const tone =
		status === "published"
			? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]"
			: status === "failed"
				? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-strong)]"
				: ["scheduled", "syncing", "publishing"].includes(status)
					? "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning-strong)]"
					: "border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent-strong)]";
	return `h-5 rounded px-1.5 text-[9px] font-bold ${tone}`;
}

function reviewLabel(status: string) {
	return (
		{
			approved: "Đã duyệt",
			draft: "Bản nháp",
			needs_review: "Cần duyệt",
			rejected: "Đã từ chối",
		}[status] ?? status
	);
}

function reviewBadgeClass(status: string) {
	const tone =
		status === "approved"
			? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]"
			: status === "rejected"
				? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-strong)]"
				: status === "needs_review"
					? "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning-strong)]"
					: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-strong)]";
	return `h-5 rounded px-1.5 text-[9px] font-bold ${tone}`;
}

function hasMetrics(metrics: ZaloCatalogArticle["metrics"]) {
	return Object.values(metrics).some((value) => value > 0);
}

function compactNumber(value: number) {
	return new Intl.NumberFormat("vi-VN", {
		compactDisplay: "short",
		notation: "compact",
	}).format(value);
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "short",
		timeStyle: "short",
		timeZone: "Asia/Ho_Chi_Minh",
	}).format(new Date(value));
}
