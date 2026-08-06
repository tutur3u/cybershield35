"use client";

import {
	MessageCircle,
	Pin,
	Scale,
	Share2,
	ShieldAlert,
	ShieldCheck,
	ThumbsUp,
	type LucideIcon,
} from "lucide-react";

import type { EvidenceTriageView, TimelinePost } from "@/components/dashboard/types";
import { DashboardTooltip } from "@/components/dashboard/ui-primitives";

import {
	sentimentLabel,
	stanceLabel,
} from "@/lib/domain/evidence-classification";

import { compactCount, triageLabels } from "./timeline-utils";

/**
 * The triage state, when there is one.
 *
 * "Mới" is the state every post starts in, so badging it put the same grey chip
 * on every card in the timeline — a column of identical labels that told a
 * reader nothing and crowded out the badges that did. Untouched is the absence
 * of triage, and absence reads better as nothing than as a word.
 */
export function TriageBadge({ status }: { status: EvidenceTriageView["status"] }) {
	if (status === "new") return null;
	const accent = status === "action_required" || status === "reviewing";
	return (
		<DashboardTooltip content={TRIAGE_HELP[status]}>
			<span
				className={`inline-flex h-6 cursor-help items-center rounded-md px-2 text-[11px] font-bold ${
					accent
						? "bg-[var(--warning-soft)] text-[var(--warning-strong)]"
						: status === "resolved"
							? "bg-[var(--success-soft)] text-[var(--success-strong)]"
							: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]"
				}`}
			>
				{triageLabels[status]}
			</span>
		</DashboardTooltip>
	);
}

const TRIAGE_HELP: Record<EvidenceTriageView["status"], string> = {
	action_required: "Đội ngũ đã đánh dấu bài này là cần hành động.",
	dismissed: "Đã xem và quyết định không xử lý tiếp.",
	new: "Chưa ai xử lý bài này.",
	resolved: "Đã xử lý xong.",
	reviewing: "Đang có người xem xét bài này.",
};

/**
 * One engagement number, with the icon that says which one it is.
 *
 * These were emoji — 👍 💬 ↗ — which render at a different size and weight on
 * every platform and sat a few pixels off the baseline of the number beside
 * them. A zero is not shown at all: absence of engagement is not a fact worth
 * three characters of a crowded header.
 */
export function EngagementStat({
	icon: Icon,
	label,
	value,
}: {
	icon: LucideIcon;
	label: string;
	value: number;
}) {
	if (!value) return null;
	return (
		<DashboardTooltip content={`${value.toLocaleString("vi-VN")} ${label}`}>
			<span className="inline-flex cursor-help items-center gap-1 text-[11px] font-semibold tabular-nums text-[var(--muted)]">
				<Icon size={13} aria-hidden />
				{compactCount(value)}
			</span>
		</DashboardTooltip>
	);
}

/** Every engagement figure a post has, or nothing when it has none. */
export function EngagementRow({
	engagement,
}: {
	engagement: TimelinePost["engagement"];
}) {
	if (!engagement.reactions && !engagement.comments && !engagement.shares) {
		return null;
	}
	return (
		<span className="inline-flex items-center gap-2.5">
			<EngagementStat icon={ThumbsUp} label="lượt thích" value={engagement.reactions} />
			<EngagementStat icon={MessageCircle} label="bình luận" value={engagement.comments} />
			<EngagementStat icon={Share2} label="lượt chia sẻ" value={engagement.shares} />
		</span>
	);
}

export function Badge({
	accent = false,
	help,
	icon: Icon,
	label,
}: {
	accent?: boolean;
	/** What the badge means. Every badge on a card should be able to say. */
	help?: string;
	icon?: typeof Pin;
	label: string;
}) {
	const badge = (
		<span
			className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-bold ${
				help ? "cursor-help" : ""
			} ${
				accent
					? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
					: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]"
			}`}
		>
			{Icon ? <Icon size={12} fill={accent ? "currentColor" : "none"} /> : null}
			{label}
		</span>
	);
	return help ? (
		<DashboardTooltip content={help}>{badge}</DashboardTooltip>
	) : (
		badge
	);
}

export function PageTrustBadge({
	classification,
}: {
	classification: TimelinePost["pageClassification"];
}) {
	if (classification === "uncategorized") return null;
	const neutral = classification === "neutral";
	const Icon = classification === "trusted" ? ShieldCheck : neutral ? Scale : ShieldAlert;
	return (
		<DashboardTooltip content={PAGE_TRUST_HELP[classification]}>
			<span
				className={`inline-flex h-6 cursor-help items-center gap-1 rounded-md px-2 text-[11px] font-bold ${
					classification === "trusted"
						? "bg-[var(--success-soft)] text-[var(--success-strong)]"
						: neutral
							? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
							: "bg-[var(--danger-soft)] text-[var(--danger-strong)]"
				}`}
			>
				<Icon size={12} />
				{classification === "trusted"
					? "Nguồn đáng tin"
					: neutral
						? "Nguồn trung lập"
						: "Nguồn có rủi ro"}
			</span>
		</DashboardTooltip>
	);
}

/**
 * What a trust badge is claiming, and who claimed it.
 *
 * The badge alone reads as a verdict on the post. It is not: it describes the
 * page the post came from, and a person on the team set it in Phân loại trang.
 * Saying so is the difference between a label a reviewer trusts blindly and one
 * they know they can change.
 */
const PAGE_TRUST_HELP: Record<TimelinePost["pageClassification"], string> = {
	at_risk:
		"Đội ngũ đã xếp trang nguồn này vào nhóm có rủi ro. Đây là đánh giá về trang, không phải về riêng bài viết này. Đổi trong mục Phân loại trang.",
	neutral:
		"Đội ngũ đã xếp trang nguồn này là trung lập. Đây là đánh giá về trang, không phải về riêng bài viết này. Đổi trong mục Phân loại trang.",
	trusted:
		"Đội ngũ đã xếp trang nguồn này là đáng tin. Đây là đánh giá về trang, không phải về riêng bài viết này. Đổi trong mục Phân loại trang.",
	uncategorized: "Trang nguồn chưa được phân loại.",
};

export function DueBadge({
	currentTime,
	dueAt,
	status,
}: {
	currentTime: number;
	dueAt: string;
	status: EvidenceTriageView["status"];
}) {
	const overdue =
		new Date(dueAt).getTime() < currentTime &&
		!["resolved", "dismissed"].includes(status);
	return (
		<span className={overdue ? "font-bold text-[var(--danger-strong)]" : ""}>
			Hạn{" "}
			{new Intl.DateTimeFormat("vi-VN", {
				dateStyle: "short",
				timeZone: "Asia/Ho_Chi_Minh",
			}).format(new Date(dueAt))}
			{overdue ? " · Quá hạn" : ""}
		</span>
	);
}

/**
 * Sentiment and stance, each in its own colour.
 *
 * These were the same grey chip as every tag beside them, so the two judgements
 * a reader scans for — is this angry, and is it against us — were the least
 * visible things on the card. Tone follows meaning rather than decoration:
 * criticism and negativity read as warning, support and positivity as calm.
 */
export function ClassificationBadge({
	kind,
	value,
}: {
	kind: "sentiment" | "stance";
	value: string;
}) {
	const label =
		kind === "sentiment" ? sentimentLabel(value) : stanceLabel(value);
	// Nothing to say about a post that concerns no agency or policy.
	if (kind === "stance" && value === "unknown") return null;

	return (
		<DashboardTooltip
			content={
				CLASSIFICATION_HELP[`${kind}:${value}`] ??
				(kind === "sentiment"
					? "Sắc thái cảm xúc của bài viết, do AI phân loại."
					: "Lập trường của bài viết với cơ quan, chính sách hoặc chủ trương, do AI phân loại.")
			}
		>
			<span
				className={`inline-flex h-6 cursor-help items-center gap-1 rounded-md px-2 text-[11px] font-bold ${CLASSIFICATION_TONES[value] ?? "bg-[var(--neutral-soft)] text-[var(--muted-strong)]"}`}
			>
				{label}
			</span>
		</DashboardTooltip>
	);
}

/**
 * Sentiment and stance measure different things and are easily confused — a
 * post can be angry in tone and still supportive in position. Keyed by both so
 * "Trung tính" explains itself differently in each column.
 */
const CLASSIFICATION_HELP: Record<string, string> = {
	"sentiment:negative": "Giọng điệu tiêu cực, bức xúc hoặc chỉ trích.",
	"sentiment:neutral": "Giọng điệu trung tính, chủ yếu là đưa tin.",
	"sentiment:positive": "Giọng điệu tích cực, ghi nhận hoặc cổ vũ.",
	"stance:critical": "Phản đối cơ quan, chính sách hoặc chủ trương được nhắc tới.",
	"stance:neutral": "Không nghiêng về phía nào trong vấn đề được nhắc tới.",
	"stance:supportive": "Ủng hộ cơ quan, chính sách hoặc chủ trương được nhắc tới.",
};

const CLASSIFICATION_TONES: Record<string, string> = {
	critical:
		"bg-[var(--danger-soft)] text-[var(--danger-strong)] ring-1 ring-[var(--danger-border)]",
	negative:
		"bg-[var(--danger-soft)] text-[var(--danger-strong)] ring-1 ring-[var(--danger-border)]",
	neutral: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]",
	positive:
		"bg-[var(--success-soft)] text-[var(--success-strong)] ring-1 ring-[var(--success-border)]",
	supportive:
		"bg-[var(--success-soft)] text-[var(--success-strong)] ring-1 ring-[var(--success-border)]",
};
