"use client";

import {
	ChevronDown,
	Database,
	ExternalLink,
	LoaderCircle,
	MessageSquareText,
	Newspaper,
	Pin,
	Sparkles,
	Users,
	Zap,
} from "lucide-react";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { intelligenceProviderLabel } from "@/components/dashboard/intelligence-workspace-shared";
import type { TimelinePost } from "@/components/dashboard/types";
import { RiskPill } from "@/components/dashboard/ui-primitives";
import { explainEvidenceRisk } from "@/lib/domain/risk-explanation";

import {
	Badge,
	ClassificationBadge,
	DueBadge,
	PageTrustBadge,
	TriageBadge,
} from "./timeline-badges";
import {
	draftActionLabel,
	formatDay,
	formatPublished,
	groupByVietnamDay,
	relativeTime,
} from "./timeline-utils";

export function TimelineCard({
	articleBusy,
	currentTime,
	isNew,
	onCreateArticle,
	onDraft,
	onTriage,
	post,
}: {
	articleBusy: boolean;
	currentTime: number;
	isNew: boolean;
	onCreateArticle: (post: TimelinePost) => void;
	onDraft: (id: string) => void;
	onTriage: (id: string) => void;
	post: TimelinePost;
}) {
	return (
		<article
			data-evidence-id={post.id}
			className={`relative rounded-xl border bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] transition ${
				isNew
					? "border-[var(--accent)] ring-1 ring-[var(--accent)]/30"
					: "border-[var(--border)] hover:border-[var(--border-strong)]"
			}`}
			style={{ contentVisibility: "auto", containIntrinsicSize: "280px" }}
		>
			{isNew ? (
				<span
					aria-hidden
					className="absolute left-0 top-4 h-8 w-1 rounded-r bg-[var(--accent)]"
				/>
			) : null}
			<div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="flex min-w-0 items-center gap-2 truncate text-sm font-extrabold text-[var(--foreground)]">
						{post.sourceLabel ?? post.author ?? intelligenceProviderLabel(post.provider)}
					</p>
					<p className="mt-1 text-xs font-semibold text-[var(--muted)]">
						{post.author ? `${post.author} · ` : ""}
						{formatPublished(post.publishedAt ?? post.createdAt)}
						{" · thu thập "}
						{relativeTime(post.createdAt, currentTime)}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<PageTrustBadge classification={post.pageClassification} />
					{post.triage.isPinned ? <Badge icon={Pin} label="Đội ngũ ghim" accent /> : null}
					<TriageBadge status={post.triage.status} />
					<RiskPill explanation={explainEvidenceRisk(post)} risk={post.riskLevel} />
				</div>
			</div>

			<IntentPrefetchLink
				href={post.href}
				className="mt-4 block whitespace-pre-wrap text-[15px] font-semibold leading-7 text-[var(--foreground)] hover:text-[var(--accent-strong)]"
			>
				{post.quote}
			</IntentPrefetchLink>
			{post.summary && post.summary !== post.quote ? (
				<p className="mt-2 text-sm leading-6 text-[var(--muted)]">{post.summary}</p>
			) : null}

			<div className="mt-4 flex flex-wrap gap-2">
				{post.topicSlugs.map((slug) => (
					<IntentPrefetchLink
						key={slug}
						href={`/topics/${slug}`}
						className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
					>
						#{slug}
					</IntentPrefetchLink>
				))}
				<ClassificationBadge kind="sentiment" value={post.sentiment} />
				<ClassificationBadge kind="stance" value={post.stance} />
			</div>

			<div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-wrap gap-3 text-xs font-semibold text-[var(--muted)]">
					<span>👍 {post.engagement.reactions.toLocaleString("vi-VN")}</span>
					<span>💬 {post.engagement.comments.toLocaleString("vi-VN")}</span>
					<span>↗ {post.engagement.shares.toLocaleString("vi-VN")}</span>
					{post.triage.assigneeDisplayName ? (
						<span className="inline-flex items-center gap-1">
							<Users size={13} /> {post.triage.assigneeDisplayName}
						</span>
					) : null}
					{post.triage.dueAt ? (
						<DueBadge
							currentTime={currentTime}
							dueAt={post.triage.dueAt}
							status={post.triage.status}
						/>
					) : null}
				</div>
				{/*
					One button, not five. The row wrapped onto two lines on every card
					and gave equal weight to the action people take — draft an article —
					and to four they rarely do, so the primary was hard to find in a hedge
					of identical grey buttons.
				*/}
				<div className="flex shrink-0 items-center">
					<button
						className="inline-flex h-9 items-center gap-1.5 rounded-l-lg bg-[var(--accent)] px-3 text-xs font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-wait disabled:opacity-70"
						disabled={articleBusy}
						onClick={() => onCreateArticle(post)}
						type="button"
					>
						{articleBusy ? (
							<LoaderCircle className="animate-spin" size={14} />
						) : (
							<Newspaper size={14} />
						)}
						{articleBusy ? "Đang soạn bài…" : "Soạn bài viết"}
					</button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								aria-label="Thao tác khác"
								className="inline-flex h-9 items-center rounded-r-lg border-l border-white/25 bg-[var(--accent)] px-2 text-white transition hover:bg-[var(--accent-strong)]"
								type="button"
							>
								<ChevronDown size={15} />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-48">
							<DropdownMenuItem onClick={() => onDraft(post.id)}>
								<Sparkles size={14} />
								{draftActionLabel(post.pageClassification)}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onTriage(post.id)}>
								<MessageSquareText size={14} /> Xử lý
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<IntentPrefetchLink href={post.href}>
									<Database size={14} /> Chi tiết
								</IntentPrefetchLink>
							</DropdownMenuItem>
							{post.originalPostHref ? (
								<DropdownMenuItem asChild>
									<a
										href={post.originalPostHref}
										rel="noreferrer"
										target="_blank"
									>
										<ExternalLink size={14} /> Bài gốc
									</a>
								</DropdownMenuItem>
							) : null}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</article>
	);
}

export function TimelineDayGroups({
	articleBusyId,
	currentTime,
	lastSeenMs,
	onCreateArticle,
	onDraft,
	onTriage,
	posts,
}: {
	articleBusyId: string | null;
	currentTime: number;
	lastSeenMs: number;
	onCreateArticle: (post: TimelinePost) => void;
	onDraft: (id: string) => void;
	onTriage: (id: string) => void;
	posts: TimelinePost[];
}) {
	const groups = groupByVietnamDay(posts);

	return (
		<div className="space-y-6">
			{groups.map(([day, items]) => {
				const freshCount = items.filter(
					(post) => Date.parse(post.createdAt) > lastSeenMs,
				).length;
				return (
					<section key={day} aria-labelledby={`day-${day}`}>
						{/*
							A plain separator. The current day lives in the toolbar, which
							is already pinned, so this does not need to compete for the same
							strip of screen — the earlier version pinned itself at a
							hard-coded offset and floated over the card above it whenever
							the toolbar changed height.
						*/}
						<div
							className="mb-3 flex items-center gap-3"
							data-day={day}
							data-day-label={formatDay(day)}
						>
							<h2
								className="shrink-0 text-[13px] font-extrabold tracking-tight text-[var(--foreground)]"
								id={`day-${day}`}
							>
								{formatDay(day)}
							</h2>
							{freshCount ? (
								<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-strong)]">
									<Zap size={10} /> {freshCount} mới
								</span>
							) : null}
							<span className="h-px flex-1 bg-[var(--border)]" />
							<span className="shrink-0 text-[11px] font-semibold text-[var(--muted)]">
								{items.length} bài
							</span>
						</div>
						<div className="space-y-3">
							{items.map((post) => (
								<TimelineCard
									key={post.id}
									articleBusy={articleBusyId === post.id}
									currentTime={currentTime}
									isNew={Date.parse(post.createdAt) > lastSeenMs}
									onCreateArticle={onCreateArticle}
									onDraft={onDraft}
									onTriage={onTriage}
									post={post}
								/>
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}
