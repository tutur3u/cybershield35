"use client";

import {
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
	cardActionClass,
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
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						disabled={articleBusy}
						onClick={() => onCreateArticle(post)}
						className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-xs font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-wait disabled:opacity-70"
					>
						{articleBusy ? (
							<LoaderCircle size={14} className="animate-spin" />
						) : (
							<Newspaper size={14} />
						)}
						{articleBusy ? "Đang soạn bài…" : "Soạn bài viết"}
					</button>
					<button
						type="button"
						onClick={() => onDraft(post.id)}
						className={cardActionClass}
					>
						<Sparkles size={14} /> {draftActionLabel(post.pageClassification)}
					</button>
					<button
						type="button"
						onClick={() => onTriage(post.id)}
						className={cardActionClass}
					>
						<MessageSquareText size={14} /> Xử lý
					</button>
					<IntentPrefetchLink href={post.href} className={cardActionClass}>
						<Database size={14} /> Chi tiết
					</IntentPrefetchLink>
					{post.originalPostHref ? (
						<a
							href={post.originalPostHref}
							target="_blank"
							rel="noreferrer"
							className={cardActionClass}
						>
							Bài gốc <ExternalLink size={12} />
						</a>
					) : null}
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
							Not sticky. It used to pin itself below the toolbar at a
							hard-coded offset, which stopped matching the moment the
							toolbar changed height — leaving the date floating over the
							card above it, translucent and attached to nothing. A date
							separator only has to mark where one day ends; it does not
							need to follow the reader down the page.
						*/}
						<div className="mb-3 flex items-center gap-3">
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
