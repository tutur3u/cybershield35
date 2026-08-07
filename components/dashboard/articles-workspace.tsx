"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowDownAZ,
	CalendarClock,
	CheckCircle2,
	Clock,
	EyeOff,
	FileDown,
	Loader,
	LoaderCircle,
	Newspaper,
	Search,
	Send,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { useConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { SafeImage } from "@/components/dashboard/safe-image";
import { DashboardTooltip } from "@/components/dashboard/ui-primitives";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { articleStatusStep } from "@/lib/articles/status-step";
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
	const [sort, setSort] = useState<ArticleListFilters["sort"]>("created_desc");
	const [importOpen, setImportOpen] = useState(false);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [bulkNotice, setBulkNotice] = useState("");
	const { confirm, dialog: confirmDialog } = useConfirmDialog();
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

	const visibleIds = articles.map(({ article }) => article.id);
	// A selection that outlives the rows it referred to would silently act on
	// articles the operator can no longer see, so it is pruned to what is loaded.
	const selectedVisible = visibleIds.filter((id) => selected.has(id));
	const allVisibleSelected =
		visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

	const bulkMutation = useMutation({
		mutationFn: (payload: Record<string, unknown>) =>
			fetchArticleJson<{
				results: Array<{ error?: string; id: string; ok: boolean }>;
			}>("/api/articles/bulk", {
				body: JSON.stringify(payload),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			}),
		onError: (error) => setBulkNotice(error.message),
		onSuccess: async (data) => {
			const failed = data.results.filter((result) => !result.ok);
			// Per-item outcomes, because a batch routinely half-succeeds: an
			// unapproved article cannot publish while its approved neighbours can.
			setBulkNotice(
				failed.length
					? `${data.results.length - failed.length}/${data.results.length} thành công. ${failed[0]?.error ?? ""}`.trim()
					: `Đã xử lý ${data.results.length} bài viết.`,
			);
			setSelected(new Set());
			await queryClient.invalidateQueries({ queryKey: articleQueryKeys.all });
		},
	});

	const cleanupMutation = useMutation({
		mutationFn: (apply: boolean) =>
			fetchArticleJson<{
				apply: boolean;
				failed: number;
				removed: number;
				scanned: number;
			}>("/api/articles/zalo-hidden-cleanup", {
				body: JSON.stringify({ apply }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			}),
		onError: (error) => setBulkNotice(error.message),
		onSuccess: async (data) => {
			if (!data.apply) {
				// Counted first, then confirmed: "remove 239 articles from Zalo" is a
				// very different decision from "remove 2".
				if (!data.scanned) {
					setBulkNotice("Không còn bản ẩn CS35 nào trên Zalo OA.");
					return;
				}
				if (
					await confirm({
						confirmLabel: `Gỡ ${data.scanned} bản ẩn`,
						description:
							"Bài đang hiển thị công khai và bài không do CS35 tạo sẽ không bị đụng tới.",
						title: `Gỡ ${data.scanned} bản ẩn CS35 khỏi Zalo OA?`,
						tone: "danger",
					})
				) {
					cleanupMutation.mutate(true);
				}
				return;
			}
			setBulkNotice(
				`Đã gỡ ${data.removed} bản ẩn khỏi Zalo OA${data.failed ? `, ${data.failed} lỗi` : ""}. Đang tiếp tục…`,
			);
			await queryClient.invalidateQueries({ queryKey: articleQueryKeys.all });
			// One call only clears a batch, because the whole backlog does not fit in
			// the function's time budget. Keep going until nothing is left, so the
			// operator does not have to guess how many times to press the button.
			if (data.removed > 0) {
				cleanupMutation.mutate(true);
				return;
			}
			setBulkNotice(
				data.failed
					? `Còn ${data.failed} bản ẩn không gỡ được. Mở Nhật ký để xem lý do.`
					: "Đã gỡ hết bản ẩn CS35 khỏi Zalo OA.",
			);
		},
	});

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
			{confirmDialog}
			<div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)] xl:flex-row xl:items-center">
				<label className="relative min-w-0 flex-1">
					<Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
					<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tiêu đề, mô tả hoặc tác giả…" className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] pl-9 pr-3 text-[12px] font-semibold outline-none focus:border-[var(--accent)]" />
				</label>
				<Filter value={review} onChange={setReview} label="Trạng thái duyệt" options={[["all", "Mọi trạng thái"], ["needs_review", "Cần duyệt"], ["approved", "Đã duyệt"], ["rejected", "Từ chối"], ["draft", "Bản nháp"]]} />
				<Filter value={state} onChange={setState} label="Trạng thái đăng" options={[["all", "Tất cả"], ["draft", "Chưa đăng"], ["published", "Đã đăng"], ["archived", "Đã lưu trữ"]]} />
				<Filter value={sort ?? "created_desc"} onChange={(value) => setSort(value as ArticleListFilters["sort"])} label="Sắp xếp" options={[["created_desc", "Mới tạo"], ["created_asc", "Cũ tạo"], ["updated_desc", "Mới cập nhật"], ["updated_asc", "Cũ cập nhật"], ["title", "Theo tiêu đề"]]} icon />
				<button type="button" onClick={() => setImportOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 text-[11px] font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"><FileDown size={14} /> Nhập từ Zalo</button>
				<DashboardTooltip content="Gỡ các bản ẩn CS35 còn sót trên Zalo OA. Chỉ đụng tới bản ẩn do CS35 tạo; bài đang hiển thị và bài của OA không bị ảnh hưởng.">
					<button
						className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 text-[11px] font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)] disabled:opacity-60"
						disabled={cleanupMutation.isPending}
						onClick={() => cleanupMutation.mutate(false)}
						type="button"
					>
						{cleanupMutation.isPending ? (
							<LoaderCircle className="animate-spin" size={14} />
						) : (
							<EyeOff size={14} />
						)}
						Dọn bản ẩn Zalo
					</button>
				</DashboardTooltip>
			</div>

			{/* The bulk bar carries its own notice, but cleanup runs with nothing
				selected — without this its result would never be seen. */}
			{!selectedVisible.length && bulkNotice ? (
				<p
					aria-live="polite"
					className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[12px] font-semibold text-[var(--muted-strong)]"
				>
					{bulkNotice}
				</p>
			) : null}

			{selectedVisible.length ? (
				<BulkActionBar
					busy={bulkMutation.isPending}
					count={selectedVisible.length}
					notice={bulkNotice}
					onClear={() => {
						setSelected(new Set());
						setBulkNotice("");
					}}
					onRun={(payload: BulkPayload) =>
						bulkMutation.mutate({ ...payload, articleIds: selectedVisible })
					}
				/>
			) : null}

			<div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
				<div className="grid grid-cols-[28px_minmax(0,1fr)_200px] items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
					<DashboardTooltip
						content={
							allVisibleSelected
								? "Bỏ chọn tất cả bài viết đang hiển thị"
								: "Chọn tất cả bài viết đang hiển thị"
						}
					>
						<input
							aria-label="Chọn tất cả bài viết đang hiển thị"
							checked={allVisibleSelected}
							className="size-4 cursor-pointer accent-[var(--accent)]"
							disabled={!visibleIds.length}
							onChange={(event) =>
								setSelected(
									event.target.checked ? new Set(visibleIds) : new Set(),
								)
							}
							type="checkbox"
						/>
					</DashboardTooltip>
					<span>Bài viết</span><span>Trạng thái</span>
				</div>
				{articles.map(({ article }) => (
					<div
						key={article.id}
						className={`grid grid-cols-[28px_minmax(0,1fr)_200px] items-center gap-3 border-b border-[var(--divider)] px-4 py-3 transition last:border-b-0 ${
							selected.has(article.id)
								? "bg-[var(--accent-soft)]"
								: "hover:bg-[var(--surface-soft)]"
						}`}
					>
						{/* Outside the link, so ticking a row never navigates away from
							the selection being built. */}
						<input
							aria-label={`Chọn ${article.title || "bài viết chưa đặt tên"}`}
							checked={selected.has(article.id)}
							className="size-4 cursor-pointer accent-[var(--accent)]"
							onChange={(event) =>
								setSelected((current) => {
									const next = new Set(current);
									if (event.target.checked) next.add(article.id);
									else next.delete(article.id);
									return next;
								})
							}
							type="checkbox"
						/>
						<Link href={`/articles/${article.id}`} className="flex min-w-0 items-center gap-3">
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
						</Link>
						<ArticleStatusCell
							reason={article.lastError}
							remote={Boolean(article.remoteArticleId)}
							reviewStatus={article.reviewStatus}
							status={article.publicationStatus}
						/>
					</div>
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

type BulkPayload =
	| { action: "set_review_status"; status: "approved" | "needs_review" | "rejected" | "draft" }
	| { action: "sync_hidden" | "publish" | "hide" | "delete" };

/**
 * Acts on the current selection.
 *
 * Destructive and audience-facing actions are separated from the review ones and
 * ask for confirmation, because the same click that approves five drafts would
 * otherwise delete five published articles.
 */
function BulkActionBar({
	busy,
	count,
	notice,
	onClear,
	onRun,
}: {
	busy: boolean;
	count: number;
	notice: string;
	onClear: () => void;
	onRun: (payload: BulkPayload) => void;
}) {
	const label = `${count} bài viết`;
	const { confirm, dialog } = useConfirmDialog();

	return (
		<div
			aria-live="polite"
			className="flex flex-col gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] p-3 sm:flex-row sm:items-center"
		>
			{dialog}
			<p className="min-w-0 flex-1 text-[12px] font-bold text-[var(--accent-strong)]">
				Đã chọn {label}
				{notice ? (
					<span className="mt-0.5 block text-[11px] font-semibold text-[var(--muted-strong)]">
						{notice}
					</span>
				) : null}
			</p>

			<div className="flex flex-wrap items-center gap-2">
				<BulkButton
					busy={busy}
					help={`Đánh dấu ${label} là đã duyệt. Chưa đưa lên Zalo OA.`}
					label="Phê duyệt"
					onClick={() => onRun({ action: "set_review_status", status: "approved" })}
				/>
				<BulkButton
					busy={busy}
					help={`Chuyển ${label} về trạng thái chờ duyệt.`}
					label="Chờ duyệt"
					onClick={() =>
						onRun({ action: "set_review_status", status: "needs_review" })
					}
				/>
				<BulkButton
					busy={busy}
					help={`Đăng công khai ${label} lên Zalo OA. Bài chưa được duyệt sẽ bị bỏ qua và báo lỗi riêng.`}
					label="Đăng lên Zalo"
					onClick={async () => {
						if (
							await confirm({
								confirmLabel: "Đăng công khai",
								description:
									"Người theo dõi Zalo OA sẽ nhìn thấy ngay. Bài chưa được duyệt sẽ bị bỏ qua.",
								title: `Đăng công khai ${label} lên Zalo OA?`,
							})
						) {
							onRun({ action: "publish" });
						}
					}}
					tone="accent"
				/>
				<BulkButton
					busy={busy}
					help={`Gỡ ${label} khỏi hiển thị công khai trên Zalo OA.`}
					label="Gỡ khỏi Zalo"
					onClick={() => onRun({ action: "hide" })}
				/>
				<BulkButton
					busy={busy}
					help={`Xóa ${label} khỏi CS35 và gỡ khỏi Zalo OA. Không thể hoàn tác.`}
					label="Xóa"
					onClick={async () => {
						if (
							await confirm({
								confirmLabel: "Xóa",
								description:
									"Bài cũng bị gỡ khỏi Zalo OA. Thao tác này không thể hoàn tác.",
								title: `Xóa ${label}?`,
								tone: "danger",
							})
						) {
							onRun({ action: "delete" });
						}
					}}
					tone="danger"
				/>
				<button
					className="inline-flex h-9 items-center rounded-md px-2.5 text-[11px] font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
					onClick={onClear}
					type="button"
				>
					Bỏ chọn
				</button>
			</div>
		</div>
	);
}

function BulkButton({
	busy,
	help,
	label,
	onClick,
	tone = "neutral",
}: {
	busy: boolean;
	help: string;
	label: string;
	onClick: () => void;
	tone?: "accent" | "danger" | "neutral";
}) {
	const className =
		tone === "danger"
			? "border-[var(--danger-border)] text-[var(--danger-strong)] hover:bg-[var(--danger-soft)]"
			: tone === "accent"
				? "border-transparent bg-[var(--accent)] text-white hover:bg-[var(--accent-fill-hover)]"
				: "border-[var(--border)] text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]";

	return (
		<DashboardTooltip content={help}>
			<button
				className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-bold transition disabled:opacity-60 ${className}`}
				disabled={busy}
				onClick={onClick}
				type="button"
			>
				{busy ? <LoaderCircle className="animate-spin" size={12} /> : null}
				{label}
			</button>
		</DashboardTooltip>
	);
}

function Filter({ icon, label, onChange, options, value }: { icon?: boolean; label: string; onChange: (value: string) => void; options: Array<[string, string]>; value: string }) {
	return <label className="relative"><span className="sr-only">{label}</span>{icon ? <ArrowDownAZ size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /> : null}<select value={value} onChange={(event) => onChange(event.target.value)} className={`h-10 min-w-36 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] pr-7 text-[11px] font-bold outline-none focus:border-[var(--accent)] ${icon ? "pl-8" : "pl-3"}`}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

/**
 * One column instead of two.
 *
 * "Duyệt" and "Trên Zalo OA" were separate, so the reader had to combine them to
 * answer the only question that matters — where is this article, and what does it
 * need next. Worse, they contradicted each other constantly: "Chờ duyệt" beside
 * "Chưa đăng" states the same fact twice, and an unapproved article showed a Zalo
 * column that could only ever say "not there yet".
 *
 * The pipeline is linear, so it renders as one position on it: draft → chờ duyệt
 * → đã duyệt → ẩn trên Zalo → đang hiển thị, with rejection and failure as the
 * two ways off that path.
 */
function ArticleStatusCell({
	reason,
	remote,
	reviewStatus,
	status,
}: {
	reason?: string | null;
	remote?: boolean;
	reviewStatus: string;
	status: string;
}) {
	const step = articleStatusStep({ reason, remote, reviewStatus, status });
	const Icon = STATUS_ICONS[step.icon];

	return (
		<DashboardTooltip
			content={
				<div className="space-y-1.5">
					<p className="font-bold">{step.label}</p>
					<p>{step.help}</p>
					{step.next ? (
						<p className="text-[10px] font-medium text-[var(--muted)]">
							Tiếp theo: {step.next}
						</p>
					) : null}
				</div>
			}
		>
			<div className="flex min-w-0 items-center gap-2">
				<span
					className={`inline-flex h-6 max-w-full shrink-0 items-center justify-center gap-1 rounded-md px-2.5 text-[11px] font-bold leading-none whitespace-nowrap ${step.className}`}
				>
					<Icon size={11} />
					{step.label}
				</span>
				<StatusTrack index={step.index} tone={step.tone} />
			</div>
		</DashboardTooltip>
	);
}

const STATUS_ICONS = {
	alert: AlertTriangle,
	approved: CheckCircle2,
	clock: Clock,
	hidden: EyeOff,
	loader: Loader,
	schedule: CalendarClock,
	send: Send,
} as const;

/** Five dots for the five positions, so progress is legible without reading. */
function StatusTrack({
	index,
	tone,
}: {
	index: number;
	tone: "danger" | "progress" | "success" | "warning";
}) {
	const fill =
		tone === "danger"
			? "bg-[var(--danger-strong)]"
			: tone === "success"
				? "bg-[var(--success-strong)]"
				: tone === "warning"
					? "bg-[var(--warning-strong)]"
					: "bg-[var(--accent)]";

	return (
		<span aria-hidden className="flex shrink-0 items-center gap-1">
			{[0, 1, 2, 3, 4].map((dot) => (
				<span
					className={`h-1.5 w-1.5 rounded-full ${dot <= index ? fill : "bg-[var(--border-strong)]"}`}
					key={dot}
				/>
			))}
		</span>
	);
}

function formatDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
