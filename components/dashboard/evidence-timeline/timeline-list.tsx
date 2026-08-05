"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import {
	formatIntelligenceDate,
	intelligenceProviderLabel,
} from "@/components/dashboard/intelligence-workspace-shared";
import type { TimelinePost } from "@/components/dashboard/types";

import { TriageBadge } from "./timeline-badges";

export function TimelineDenseList({
	lastSeenMs,
	onTriage,
	posts,
}: {
	lastSeenMs: number;
	onTriage: (id: string) => void;
	posts: TimelinePost[];
}) {
	const parentRef = useRef<HTMLDivElement | null>(null);
	// eslint-disable-next-line react-hooks/incompatible-library
	const virtualizer = useVirtualizer({
		count: posts.length,
		estimateSize: () => 118,
		getScrollElement: () => parentRef.current,
		overscan: 10,
	});

	return (
		<div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
			<div ref={parentRef} className="max-h-[720px] overflow-auto">
				<div className="relative" style={{ height: `${virtualizer.getTotalSize()}px` }}>
					{virtualizer.getVirtualItems().map((row) => {
						const post = posts[row.index];
						if (!post) return null;
						const isNew = Date.parse(post.createdAt) > lastSeenMs;
						return (
							<div
								key={post.id}
								ref={virtualizer.measureElement}
								data-index={row.index}
								className={`absolute left-0 top-0 w-full border-b border-[var(--border)] ${
									isNew ? "bg-[var(--accent-soft)]/40" : ""
								}`}
								style={{ transform: `translateY(${row.start}px)` }}
							>
								<div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_150px_120px] sm:items-center">
									<div className="min-w-0">
										<IntentPrefetchLink
											href={post.href}
											className="line-clamp-2 text-sm font-bold text-[var(--foreground)]"
										>
											{post.quote}
										</IntentPrefetchLink>
										<p className="mt-1 flex items-center gap-2 truncate text-xs text-[var(--muted)]">
											{isNew ? (
												<span className="inline-flex shrink-0 items-center rounded bg-[var(--accent)] px-1 py-0.5 text-[9px] font-bold uppercase text-white">
													Mới
												</span>
											) : null}
											{post.sourceLabel ??
												post.author ??
												intelligenceProviderLabel(post.provider)}
										</p>
									</div>
									<div className="text-xs font-semibold text-[var(--muted)]">
										<p>{formatIntelligenceDate(post.publishedAt ?? post.createdAt)}</p>
										<p className="mt-1">
											{post.engagement.total.toLocaleString("vi-VN")} tương tác
										</p>
									</div>
									<button
										type="button"
										onClick={() => onTriage(post.id)}
										className="justify-self-start"
									>
										<TriageBadge status={post.triage.status} />
									</button>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
