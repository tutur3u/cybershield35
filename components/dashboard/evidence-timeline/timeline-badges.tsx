"use client";

import { Pin, Scale, ShieldAlert, ShieldCheck } from "lucide-react";

import type { EvidenceTriageView, TimelinePost } from "@/components/dashboard/types";

import {
	sentimentLabel,
	stanceLabel,
} from "@/lib/domain/evidence-classification";

import { triageLabels } from "./timeline-utils";

export function TriageBadge({ status }: { status: EvidenceTriageView["status"] }) {
	const accent = status === "action_required" || status === "reviewing";
	return (
		<span
			className={`inline-flex h-6 items-center rounded-md px-2 text-[11px] font-bold ${
				accent
					? "bg-[var(--warning-soft)] text-[var(--warning-strong)]"
					: status === "resolved"
						? "bg-[var(--success-soft)] text-[var(--success-strong)]"
						: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]"
			}`}
		>
			{triageLabels[status]}
		</span>
	);
}

export function Badge({
	accent = false,
	icon: Icon,
	label,
}: {
	accent?: boolean;
	icon?: typeof Pin;
	label: string;
}) {
	return (
		<span
			className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-bold ${
				accent
					? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
					: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]"
			}`}
		>
			{Icon ? <Icon size={12} fill={accent ? "currentColor" : "none"} /> : null}
			{label}
		</span>
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
		<span
			className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-bold ${
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
	);
}

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
		<span
			className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-bold ${CLASSIFICATION_TONES[value] ?? "bg-[var(--neutral-soft)] text-[var(--muted-strong)]"}`}
		>
			{label}
		</span>
	);
}

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
