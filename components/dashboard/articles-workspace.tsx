"use client";

import { useQuery } from "@tanstack/react-query";
import {
	ArrowRight,
	CalendarClock,
	FilePlus2,
	Newspaper,
	Radio,
} from "lucide-react";
import Link from "next/link";

import { Panel, PanelHeader } from "@/components/dashboard/ui-primitives";

type ArticleListItem = {
	article: {
		description: string;
		id: string;
		publicationStatus: string;
		reviewStatus: string;
		scheduledAt: string | null;
		title: string;
		updatedAt: string;
	};
	oaDisplayName: string | null;
};

export function ArticlesWorkspace() {
	const query = useQuery({
		queryKey: ["articles"],
		queryFn: () => fetchJson<{ articles: ArticleListItem[] }>("/api/articles"),
	});

	return (
		<Panel>
			<PanelHeader
				title="Không gian bài viết"
				description="Soạn, duyệt, đồng bộ bản ẩn và xuất bản lên Zalo OA với từng bước xác nhận rõ ràng."
				action={
					<Link
						href="/articles/new"
						className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--brand)] px-3 text-[12px] font-bold text-white"
					>
						<FilePlus2 size={15} />
						Bài viết mới
					</Link>
				}
			/>
			<div className="p-4">
				{query.isPending ? (
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{Array.from({ length: 6 }).map((_, index) => (
							<div
								key={index}
								className="h-40 animate-pulse rounded-lg bg-[var(--surface-soft)]"
							/>
						))}
					</div>
				) : query.isError ? (
					<div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger-strong)]">
						{query.error.message}
					</div>
				) : query.data.articles.length === 0 ? (
					<div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-8 text-center">
						<div>
							<span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--success-soft)] text-[var(--brand)]">
								<Newspaper size={26} />
							</span>
							<h2 className="mt-4 text-base font-bold">Chưa có bài viết</h2>
							<p className="mt-2 max-w-md text-[13px] leading-5 text-[var(--muted)]">
								Tạo bài viết từ đầu, hoặc yêu cầu Chat tạo một bài từ scan và bằng
								chứng đã lưu.
							</p>
							<Link
								href="/articles/new"
								className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[var(--brand)] px-4 text-[12px] font-bold text-white"
							>
								<FilePlus2 size={15} /> Tạo bài đầu tiên
							</Link>
						</div>
					</div>
				) : (
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{query.data.articles.map(({ article, oaDisplayName }) => (
							<Link
								key={article.id}
								href={`/articles/${article.id}`}
								className="group rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[var(--shadow-soft)]"
							>
								<div className="flex items-start justify-between gap-3">
									<span className={statusClass(article.publicationStatus)}>
										{publicationLabel(article.publicationStatus)}
									</span>
									<ArrowRight
										size={15}
										className="text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand)]"
									/>
								</div>
								<h2 className="mt-3 line-clamp-2 text-[15px] font-bold leading-6">
									{article.title || "Bài viết chưa đặt tên"}
								</h2>
								<p className="mt-2 line-clamp-2 min-h-10 text-[12px] leading-5 text-[var(--muted)]">
									{article.description || "Chưa có mô tả. Mở bài viết để tiếp tục biên tập."}
								</p>
								<div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[var(--muted)]">
									<span className="inline-flex items-center gap-1">
										<Radio size={12} /> {oaDisplayName ?? "Chưa chọn OA"}
									</span>
									{article.scheduledAt ? (
										<span className="inline-flex items-center gap-1">
											<CalendarClock size={12} />
											{formatDate(article.scheduledAt)}
										</span>
									) : null}
								</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</Panel>
	);
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
		hidden: "Bản ẩn Zalo",
		not_synced: "Chưa đồng bộ",
		published: "Đã xuất bản",
		publishing: "Đang xuất bản",
		scheduled: "Đã lên lịch",
		syncing: "Đang đồng bộ",
	};
	return labels[status] ?? status;
}

function statusClass(status: string) {
	const tone =
		status === "published"
			? "bg-[var(--success-soft)] text-[var(--success-strong)]"
			: status === "failed"
				? "bg-[var(--danger-soft)] text-[var(--danger-strong)]"
				: ["scheduled", "syncing", "publishing"].includes(status)
					? "bg-[var(--warning-soft)] text-[var(--warning-strong)]"
					: "bg-[var(--accent-soft)] text-[var(--accent-strong)]";
	return `inline-flex h-6 items-center rounded-md px-2 text-[10px] font-bold ${tone}`;
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "short",
		timeStyle: "short",
		timeZone: "Asia/Ho_Chi_Minh",
	}).format(new Date(value));
}
