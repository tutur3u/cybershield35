"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	CheckCircle2,
	FilePenLine,
	LoaderCircle,
	Search,
	ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Draft = {
	body: string;
	createdAt: string;
	createdByDisplayName: string | null;
	draftKind: "response" | "comment" | "counter_argument" | "internal_brief";
	evidenceItemId: string | null;
	evidenceQuote: string | null;
	generationReason: string | null;
	id: string;
	scanJobId: string;
	status: "draft" | "needs_review" | "approved" | "rejected";
	tone: string;
};

type DraftPage = { hasNextPage: boolean; items: Draft[]; nextCursor: string | null };

const kindLabels = { comment: "Bình luận", counter_argument: "Phản biện", internal_brief: "Tóm tắt nội bộ", response: "Phản hồi" } as const;
const statusLabels = { approved: "Đã duyệt", draft: "Bản nháp", needs_review: "Cần duyệt", rejected: "Từ chối" } as const;

export function DraftsWorkspace() {
	const [kind, setKind] = useState("");
	const [status, setStatus] = useState("");
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [reviewingId, setReviewingId] = useState<string | null>(null);
	const [notice, setNotice] = useState("");
	const sentinel = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
		return () => window.clearTimeout(timer);
	}, [query]);
	const search = useMemo(() => {
		const params = new URLSearchParams({ limit: "24" });
		if (kind) params.set("kind", kind);
		if (status) params.set("status", status);
		if (debouncedQuery) params.set("q", debouncedQuery);
		return params.toString();
	}, [debouncedQuery, kind, status]);
	const drafts = useInfiniteQuery({
		getNextPageParam: (page: DraftPage) => page.nextCursor ?? undefined,
		initialPageParam: undefined as string | undefined,
		queryFn: async ({ pageParam }) => {
			const response = await fetch(`/api/drafts?${search}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`, { cache: "no-store" });
			const body = await response.json();
			if (!response.ok) throw new Error(body?.error ?? "Không thể tải bản nháp.");
			return body as DraftPage;
		},
		queryKey: ["drafts", search],
	});
	const { fetchNextPage, hasNextPage, isFetchingNextPage } = drafts;
	useEffect(() => {
		const element = sentinel.current;
		if (!element || !hasNextPage) return;
		const observer = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
		}, { rootMargin: "400px" });
		observer.observe(element);
		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);
	const items = drafts.data?.pages.flatMap((page) => page.items) ?? [];

	async function review(draft: Draft, nextStatus: "approved" | "rejected") {
		if (reviewingId) return;
		setReviewingId(draft.id);
		setNotice("");
		try {
			const response = await fetch(`/api/drafts/${draft.id}/review`, {
				body: JSON.stringify({ status: nextStatus }),
				cache: "no-store",
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			const payload = await response.json().catch(() => null);
			if (!response.ok) throw new Error(payload?.error ?? "Không thể cập nhật bản nháp.");
			setNotice(nextStatus === "approved" ? "Đã phê duyệt bản nháp." : "Đã từ chối bản nháp.");
			await drafts.refetch();
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Không thể cập nhật bản nháp.");
		} finally {
			setReviewingId(null);
		}
	}

	return (
		<div className="space-y-4">
			<div className="sticky top-2 z-10 grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-sm backdrop-blur sm:grid-cols-[minmax(0,1fr)_180px_180px]">
				<label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={15} /><input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm nội dung hoặc bằng chứng…" /></label>
				<select className={inputClass} value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Loại bản nháp"><option value="">Mọi loại</option>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
				<select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Trạng thái"><option value="">Mọi trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
			</div>
			{notice ? <p aria-live="polite" className="rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--muted-strong)]">{notice}</p> : null}
			{drafts.isError ? <div role="alert" className="rounded-lg border border-[var(--danger-strong)] p-6 text-center text-sm font-bold text-[var(--danger-strong)]">{drafts.error.message}</div> : null}
			{drafts.isPending ? <div className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-[var(--brand)]" /></div> : null}
			{!drafts.isPending && items.length === 0 ? <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center"><FilePenLine className="mx-auto text-[var(--muted)]" /><p className="mt-3 text-sm font-bold">Chưa có bản nháp phù hợp.</p></div> : null}
			<div className="grid gap-3 xl:grid-cols-2">{items.map((draft) => (
				<article key={draft.id} className="group rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition hover:border-[var(--border-strong)]">
					<div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><Badge>{kindLabels[draft.draftKind]}</Badge><Badge>{statusLabels[draft.status]}</Badge></div><span className="text-[10px] font-semibold text-[var(--muted)]">{formatDate(draft.createdAt)}</span></div>
					{draft.generationReason ? <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-bold text-[var(--accent-strong)]"><ShieldCheck size={12} />{draft.generationReason === "at_risk_page" ? "Tự động: nguồn có rủi ro" : "Tự động: nội dung tích cực từ nguồn đáng tin"}</p> : null}
					<Link href={`/drafts/${draft.id}?scanId=${draft.scanJobId}`} className="mt-3 block line-clamp-4 whitespace-pre-wrap text-sm font-semibold leading-6 text-[var(--foreground)] group-hover:text-[var(--accent-strong)]">{draft.body}</Link>
					{draft.evidenceQuote ? <p className="mt-3 line-clamp-2 border-l-2 border-[var(--accent)] pl-3 text-xs leading-5 text-[var(--muted)]">{draft.evidenceQuote}</p> : null}
					<div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-[10px] font-semibold text-[var(--muted)]">{draft.createdByDisplayName ?? "Thành viên"} · {draft.tone}</span><div className="flex flex-wrap gap-2"><Link href={`/drafts/${draft.id}?scanId=${draft.scanJobId}`} className="inline-flex h-9 items-center rounded-md border border-[var(--border)] px-3 text-[11px] font-bold text-[var(--muted-strong)]">Chi tiết</Link><button type="button" disabled={reviewingId !== null || draft.status === "rejected"} onClick={() => void review(draft, "rejected")} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-[11px] font-bold text-[var(--muted-strong)] disabled:opacity-50">{reviewingId === draft.id ? <LoaderCircle className="animate-spin" size={13} /> : <AlertTriangle size={13} />}Từ chối</button><button type="button" disabled={reviewingId !== null || draft.status === "approved"} onClick={() => void review(draft, "approved")} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 text-[11px] font-bold text-white disabled:opacity-50">{reviewingId === draft.id ? <LoaderCircle className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}Phê duyệt</button></div></div>
				</article>
			))}</div>
			<div ref={sentinel} className="h-px" aria-hidden />
			{hasNextPage ? <div className="text-center"><button className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border)] px-4 text-xs font-bold" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>{isFetchingNextPage ? <LoaderCircle className="animate-spin" size={14} /> : null}Tải thêm</button></div> : null}
		</div>
	);
}

function Badge({ children }: { children: string }) { return <span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-bold text-[var(--accent-strong)]">{children}</span>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }
const inputClass = "h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-xs font-semibold outline-none focus:border-[var(--accent)]";
