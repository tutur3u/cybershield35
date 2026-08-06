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
	// Providers often store the opening of the quote as the summary, so the card
	// printed the same sentence twice before saying anything new.
	const summary =
		post.summary && !post.quote.startsWith(post.summary.slice(0, 60))
			? post.summary
			: null;
	/*
	 * The name the team saved for the page, not the handle the scraper captured.
	 * The card used to lead with "example-org" — or worse, "facebook.com" — while
	 * "Tổ chức ví dụ", the name the team chose and reads everywhere else in the
	 * product, was nowhere on it.
	 */
	const name =
		post.pageDisplayName ??
		post.sourceLabel ??
		post.author ??
		intelligenceProviderLabel(post.provider);
	const rawHandle = post.pageUsername ?? post.author ?? null;
	// Only a handle: dropping it when it merely repeats the name avoids
	// "Tổ chức ví dụ / @Tổ chức ví dụ".
	const handle =
		rawHandle && rawHandle.toLowerCase() !== name.toLowerCase()
			? rawHandle.replace(/^@/u, "")
			: null;
	const shownTopics = post.topicSlugs.slice(0, 3);
	const hiddenTopicCount = post.topicSlugs.length - shownTopics.length;

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
				<div className="flex min-w-0 items-center gap-2.5">
					<span
						aria-hidden
						className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-soft)] text-[13px] font-extrabold text-[var(--muted-strong)]"
					>
						{name.trim().charAt(0).toUpperCase() || "?"}
					</span>
					<span className="min-w-0">
						<span className="block truncate text-[13px] font-extrabold text-[var(--foreground)]">
							{name}
						</span>
						<span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)]">
							{handle ? <span className="truncate">@{handle}</span> : null}
							{handle ? <span aria-hidden>·</span> : null}
							<span
								className="shrink-0"
								title={formatPublished(post.publishedAt ?? post.createdAt)}
							>
								{relativeTime(post.createdAt, currentTime)}
							</span>
						</span>
					</span>
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
				className="mt-3 block line-clamp-6 whitespace-pre-wrap text-[14px] leading-6 font-medium text-[var(--foreground)] transition hover:text-[var(--accent-strong)]"
			>
				{post.quote}
			</IntentPrefetchLink>
			{summary ? (
				<p className="mt-2 line-clamp-2 text-[12.5px] leading-5 text-[var(--muted)]">
					{summary}
				</p>
			) : null}

			<div className="mt-3 flex flex-wrap items-center gap-1.5">
				<ClassificationBadge kind="sentiment" value={post.sentiment} />
				<ClassificationBadge kind="stance" value={post.stance} />
				{shownTopics.map((slug) => (
					<IntentPrefetchLink
						className="rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--muted-strong)] transition hover:text-[var(--accent-strong)]"
						href={`/topics/${slug}`}
						key={slug}
					>
						#{slug}
					</IntentPrefetchLink>
				))}
				{hiddenTopicCount ? (
					<IntentPrefetchLink
						className="rounded-md px-1.5 py-1 text-[11px] font-bold text-[var(--muted)] transition hover:text-[var(--foreground)]"
						href={post.href}
					>
						+{hiddenTopicCount}
					</IntentPrefetchLink>
				) : null}
			</div>

			<div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[var(--muted)]">
					<EngagementCount icon="👍" value={post.engagement.reactions} />
					<EngagementCount icon="💬" value={post.engagement.comments} />
					<EngagementCount icon="↗" value={post.engagement.shares} />
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
						className="inline-flex h-9 items-center gap-1.5 rounded-l-lg bg-[var(--accent-fill)] px-3.5 text-xs font-bold text-[var(--accent-on-fill)] transition hover:bg-[var(--accent-fill-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:cursor-wait disabled:opacity-70"
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
								className="inline-flex h-9 items-center rounded-r-lg border-l border-[var(--accent-on-fill)]/25 bg-[var(--accent-fill)] px-2 text-[var(--accent-on-fill)] transition hover:bg-[var(--accent-fill-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 data-[state=open]:bg-[var(--accent-fill-hover)]"
								type="button"
							>
								<ChevronDown size={15} />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-52">
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

/** A count worth showing, or nothing at all. */
function EngagementCount({ icon, value }: { icon: string; value: number }) {
	if (!value) return null;
	return (
		<span>
			{icon} {value.toLocaleString("vi-VN")}
		</span>
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
