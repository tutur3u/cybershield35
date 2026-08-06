import type { TimelineFilters, TimelinePost } from "@/components/dashboard/types";
import { intelligenceProviderLabel } from "@/components/dashboard/intelligence-workspace-shared";
import {
	EVIDENCE_TRIAGE_LABELS,
	sentimentLabel,
	stanceLabel,
} from "@/lib/domain/evidence-classification";

export const LAST_SEEN_STORAGE_KEY = "cs35.timeline.lastSeenCollectedAt";

export const triageLabels = EVIDENCE_TRIAGE_LABELS as Record<
	TimelinePost["triage"]["status"],
	string
>;

export function filtersFromParams(
	params: Readonly<URLSearchParams>,
): TimelineFilters {
	return {
		assignee: params.get("assignee") ?? undefined,
		dateFrom: params.get("dateFrom") ?? undefined,
		dateTo: params.get("dateTo") ?? undefined,
		due: (params.get("due") as TimelineFilters["due"]) ?? "all",
		facebookPage: params.get("facebookPage") ?? undefined,
		isPinned: params.has("isPinned") ? params.get("isPinned") === "true" : undefined,
		provider: params.get("provider") ?? undefined,
		query: params.get("q") ?? undefined,
		risk: (params.get("risk") as TimelineFilters["risk"]) ?? "all",
		sentiment: params.get("sentiment") ?? undefined,
		sort: (params.get("sort") as TimelineFilters["sort"]) ?? "published-desc",
		stance: params.get("stance") ?? undefined,
		timeRange: (params.get("timeRange") as TimelineFilters["timeRange"]) ?? "all",
		topic: params.get("topic") ?? undefined,
		triageStatus:
			(params.get("triageStatus") as TimelineFilters["triageStatus"]) ?? "all",
	};
}

export function activeFilterEntries(filters: TimelineFilters): [string, string][] {
	const timeRangeLabels: Record<string, string> = {
		"7d": "7 ngày qua",
		"30d": "30 ngày qua",
		"90d": "90 ngày qua",
	};
	const riskLabels: Record<string, string> = {
		high: "cao",
		low: "thấp",
		medium: "trung bình",
	};
	const dueLabels: Record<string, string> = {
		none: "Không có hạn",
		overdue: "Quá hạn",
		today: "Hạn hôm nay",
	};
	const labels: [string, string | undefined][] = [
		["q", filters.query ? `Tìm: ${filters.query}` : undefined],
		[
			"timeRange",
			filters.timeRange !== "all"
				? (timeRangeLabels[filters.timeRange ?? ""] ?? undefined)
				: undefined,
		],
		["facebookPage", filters.facebookPage ? `Trang: ${filters.facebookPage}` : undefined],
		["provider", filters.provider ? intelligenceProviderLabel(filters.provider) : undefined],
		[
			"risk",
			filters.risk !== "all"
				? `Rủi ro ${riskLabels[filters.risk ?? ""] ?? filters.risk}`
				: undefined,
		],
		["sentiment", filters.sentiment ? sentimentLabel(filters.sentiment) : undefined],
		["stance", filters.stance ? stanceLabel(filters.stance) : undefined],
		[
			"triageStatus",
			filters.triageStatus !== "all"
				? triageLabels[filters.triageStatus as TimelinePost["triage"]["status"]]
				: undefined,
		],
		["assignee", filters.assignee ? "Có phân công" : undefined],
		[
			"isPinned",
			filters.isPinned !== undefined
				? filters.isPinned
					? "Đã ghim"
					: "Chưa ghim"
				: undefined,
		],
		[
			"due",
			filters.due && filters.due !== "all"
				? (dueLabels[filters.due] ?? undefined)
				: undefined,
		],
		["dateFrom", filters.dateFrom ? `Từ ${filters.dateFrom}` : undefined],
		["dateTo", filters.dateTo ? `Đến ${filters.dateTo}` : undefined],
		["topic", filters.topic ? `#${filters.topic}` : undefined],
	];
	return labels.filter((entry): entry is [string, string] => Boolean(entry[1]));
}

export function knownAssignees(posts: TimelinePost[]): [string, string][] {
	const map = new Map<string, string>();
	for (const post of posts) {
		if (post.triage.assigneeUserId) {
			map.set(
				post.triage.assigneeUserId,
				post.triage.assigneeDisplayName ?? post.triage.assigneeUserId,
			);
		}
	}
	return [...map];
}

export function groupByVietnamDay(posts: TimelinePost[]) {
	const groups = new Map<string, TimelinePost[]>();
	for (const post of posts) {
		const day = new Intl.DateTimeFormat("en-CA", {
			day: "2-digit",
			month: "2-digit",
			timeZone: "Asia/Ho_Chi_Minh",
			year: "numeric",
		}).format(new Date(post.publishedAt ?? post.createdAt));
		groups.set(day, [...(groups.get(day) ?? []), post]);
	}
	return [...groups];
}

export function formatDay(day: string) {
	return new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "full",
		timeZone: "Asia/Ho_Chi_Minh",
	}).format(new Date(`${day}T00:00:00+07:00`));
}

export function formatPublished(value: string) {
	return new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: "Asia/Ho_Chi_Minh",
	}).format(new Date(value));
}

export function relativeTime(value: string, now: number) {
	const seconds = Math.max(1, Math.round((now - Date.parse(value)) / 1000));
	if (seconds < 60) return "vừa xong";
	if (seconds < 3_600) return `${Math.floor(seconds / 60)} phút trước`;
	if (seconds < 86_400) return `${Math.floor(seconds / 3_600)} giờ trước`;
	return `${Math.floor(seconds / 86_400)} ngày trước`;
}

// Re-exported from the shared vocabulary. Keeping a second copy here is how the
// filter came to offer "opposed" against a stored "critical" — a choice that
// looked right and matched nothing.
export { sentimentLabel, stanceLabel } from "@/lib/domain/evidence-classification";

export function draftActionLabel(classification: TimelinePost["pageClassification"]) {
	return classification === "trusted"
		? "Phản hồi tích cực"
		: classification === "at_risk"
			? "Phản biện"
			: "Phản hồi";
}

export const inputClass =
	"h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]";
export const filterLabelClass =
	"block text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]";
export const toolButtonClass =
	"inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)] disabled:opacity-50";
export const cardActionClass =
	"inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]";

/**
 * Big numbers, shortened.
 *
 * A post with 128.400 reactions pushed everything else in the card header off
 * the row. "128,4K" says the same thing in a third of the width, and the
 * tooltip beside it carries the exact figure for anyone who needs it.
 */
export function compactCount(value: number) {
	if (value < 10_000) return value.toLocaleString("vi-VN");
	if (value < 1_000_000) {
		return `${(value / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}K`;
	}
	return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}M`;
}
