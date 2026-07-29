"use client";

import { useQuery } from "@tanstack/react-query";
import {
	ArrowDown,
	ArrowDownAZ,
	ArrowRight,
	ArrowUp,
	CalendarClock,
	Eye,
	FilePlus2,
	Heart,
	MessageCircle,
	Newspaper,
	Radio,
	Search,
	Share2,
	ShieldCheck,
	X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { Panel, PanelHeader } from "@/components/dashboard/ui-primitives";
import { DashboardTooltip } from "@/components/dashboard/ui-primitives";
import { Badge } from "@/components/ui/badge";
import type { ZaloCatalogArticle } from "@/lib/zalo/article-catalog";

type LocalArticleListItem = {
	article: {
		coverUrl: string | null;
		createdAt: string;
		description: string;
		id: string;
		originDraftId: string | null;
		publicationStatus: string;
		remoteArticleId: string | null;
		reviewStatus: string;
		scheduledAt: string | null;
		title: string;
		updatedAt: string;
	};
	oaDisplayName: string | null;
	oaId: string | null;
};

type ArticleCatalogResponse = {
	articles: LocalArticleListItem[];
	zaloArticles: ZaloCatalogArticle[];
	zaloIssues: Array<{ message: string; oaDisplayName: string }>;
};

type CatalogArticle = {
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
const ZALO_OA_MANAGER_URL = "https://oa.zalo.me/manage/oa";

export function ArticlesWorkspace() {
	const query = useQuery({
		queryKey: ["articles"],
		queryFn: () => fetchJson<ArticleCatalogResponse>("/api/articles"),
		staleTime: 60_000,
	});
	const [search, setSearch] = useState("");
	const [source, setSource] = useState<"all" | "cs35" | "zalo">("all");
	const [status, setStatus] = useState("all");
	const [oa, setOa] = useState("all");
	const [sort, setSort] = useState<SortMode>("updated_desc");
	const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase("vi"));

	const catalog = useMemo(
		() => buildCatalog(query.data),
		[query.data],
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

	return (
		<Panel>
			<PanelHeader
				title="Không gian bài viết"
				description="Một danh sách thống nhất cho bài tạo trên CS35 và nội dung hiện có trên các Zalo OA đã kết nối."
				action={
					<Link
						href="/articles/new"
						className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--brand)] px-3 text-[11px] font-bold text-white"
					>
						<FilePlus2 size={14} />
						Bài viết mới
					</Link>
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
						{visibleArticles.length} / {catalog.length} bài viết
					</Badge>
					{query.data?.zaloIssues.length ? (
						<DashboardTooltip
							content={
								<div className="space-y-1">
									{query.data.zaloIssues.map((issue) => (
										<p key={issue.oaDisplayName}>
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
								{query.data.zaloIssues.length} OA cần làm mới
							</Badge>
						</DashboardTooltip>
					) : null}
				</div>
			</div>
			<div className="p-3">
				{query.isPending ? (
					<div className="space-y-2">
						{Array.from({ length: 7 }).map((_, index) => (
							<div
								key={index}
								className="h-[92px] animate-pulse rounded-lg bg-[var(--surface-soft)]"
							/>
						))}
					</div>
				) : query.isError ? (
					<div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger-strong)]">
						{query.error.message}
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
						{visibleArticles.map((article) => (
							<ArticleCatalogRow key={article.id} article={article} />
						))}
					</div>
				)}
			</div>
		</Panel>
	);
}

function ArticleCatalogRow({ article }: { article: CatalogArticle }) {
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
		"group flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--brand)] hover:bg-[var(--surface-soft)] sm:flex-row sm:items-center";

	return article.origin === "cs35" ? (
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

function buildCatalog(data: ArticleCatalogResponse | undefined): CatalogArticle[] {
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

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, { cache: "no-store" });
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(body?.error ?? "Không thể tải dữ liệu.");
	}
	return body as T;
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
