"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import {
	formatIntelligenceDate,
	intelligenceProviderLabel,
} from "@/components/dashboard/intelligence-workspace-shared";
import type { TimelinePost } from "@/components/dashboard/types";
import { pageIdentity } from "@/lib/domain/page-identity";

import { EngagementRow, TriageBadge } from "./timeline-badges";

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
						const { handle, name } = pageIdentity({
							author: post.author,
							displayName: post.pageDisplayName,
							fallback: intelligenceProviderLabel(post.provider),
							handle: post.pageUsername,
							sourceUrl: post.sourceUrl,
						});
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
								{/* The middle column carries three figures rather than one
									total now, so it needs the room the breakdown asks for. */}
								<div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_180px_120px] sm:items-center">
									<div className="min-w-0">
										<IntentPrefetchLink
											href={post.href}
											className="line-clamp-2 text-sm font-bold text-[var(--foreground)]"
										>
											{post.quote}
										</IntentPrefetchLink>
										<p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-[var(--muted)]">
											<span className="truncate font-semibold text-[var(--muted-strong)]">
												{name}
											</span>
											{handle ? (
												<span className="truncate">@{handle}</span>
											) : null}
										</p>
									</div>
									<div className="text-xs font-semibold text-[var(--muted)]">
										<p>{formatIntelligenceDate(post.publishedAt ?? post.createdAt)}</p>
										{/*
											The same treatment the cards use: icons rather than the
											word "tương tác", and nothing at all when there has been
											no engagement. "0 tương tác" filled the column on the
											quietest rows and said only that nobody had reacted yet.
										*/}
										<span className="mt-1 flex">
											<EngagementRow engagement={post.engagement} />
										</span>
									</div>
									<button
										type="button"
										onClick={() => onTriage(post.id)}
										className="justify-self-start rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
									>
										{/* Untouched posts carry no badge, so the column needs its
											own affordance or the row loses its way into triage. */}
										{post.triage.status === "new" ? (
											<span className="inline-flex h-6 items-center rounded-md border border-dashed border-[var(--border-strong)] px-2 text-[11px] font-bold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]">
												Xử lý
											</span>
										) : (
											<TriageBadge status={post.triage.status} />
										)}
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
