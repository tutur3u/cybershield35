import type { TrackedSourceView } from "@/components/dashboard/types";
import {
	classifyTrackedSourceAutomation,
	type TrackedSourceAutomationDecision,
} from "@/lib/domain/tracked-source-automation";

export type SourceAutomationState = TrackedSourceAutomationDecision;

export type SourceFilterKey = "active" | "all" | "due" | "paused";

export type PagePolicyFeedback = {
	message: string;
	tone: "error" | "info" | "success";
};

export function sourceAutomationState(
	source: TrackedSourceView,
): SourceAutomationState {
	return classifyTrackedSourceAutomation({
		isActive: source.isActive,
		lastScannedAt: source.lastScannedAt,
		lastScanStatus: source.lastScanStatus,
	});
}

export function facebookIdentity(source: TrackedSourceView) {
	const metadata = source.metadata ?? {};
	const metadataId =
		typeof metadata.facebookId === "string" ? metadata.facebookId : null;
	const metadataLabel = typeof metadata.label === "string" ? metadata.label : null;
	return {
		facebookId: metadataId,
		username:
			cleanFacebookHandle(metadataLabel) ??
			usernameFromFacebookUrl(source.normalizedUrl),
	};
}

export function usernameFromFacebookUrl(value?: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		if (!/(^|\.)facebook\.com$/iu.test(url.hostname)) return null;
		return cleanFacebookHandle(url.pathname.split("/").filter(Boolean)[0]);
	} catch {
		return null;
	}
}

export function cleanFacebookHandle(value?: string | null): string | null {
	const cleaned = value?.trim().replace(/^@/u, "");
	if (!cleaned || /^\d+$/u.test(cleaned) || /facebook\.com/iu.test(cleaned)) {
		return null;
	}
	return cleaned.slice(0, 160);
}

export function metricToneClass(
	tone: "accent" | "neutral" | "success" | "warning",
) {
	if (tone === "accent") return "text-[var(--accent-strong)]";
	if (tone === "success") return "text-[var(--success-strong)]";
	if (tone === "warning") return "text-[var(--warning-strong)]";
	return "text-[var(--foreground)]";
}

export function cronStatusLabel(status: string) {
	return (
		{
			failed: "Lỗi",
			manual: "Chạy thủ công",
			success: "Thành công",
			unknown: "Chưa rõ",
		}[status] ?? status
	);
}

export function formatDate(value?: Date | string | null) {
	if (!value) return "Chưa có";
	try {
		return new Intl.DateTimeFormat("vi-VN", {
			dateStyle: "short",
			timeStyle: "short",
		}).format(new Date(value));
	} catch {
		return String(value);
	}
}

export function sourceKindLabel(provider: string) {
	return (
		{
			apify_facebook_comments: "Bình luận Facebook",
			apify_facebook_groups: "Nhóm Facebook",
			apify_facebook_posts: "Bài viết Facebook",
			browser_use: "Trang web công khai",
			firecrawl: "Trang web",
			firecrawl_parse: "Trang web",
			local_text: "Văn bản nội bộ",
		}[provider] ?? "Nguồn khác"
	);
}

export function scanStatusLabel(status: string) {
	return (
		{
			completed: "hoàn tất",
			failed: "lỗi",
			queued: "đang chờ",
			retrying: "đang thử lại",
			running: "đang quét",
		}[status] ?? status
	);
}
