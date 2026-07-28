import { ApifyClient } from "apify-client";

import { assessEvidenceRisk } from "@/lib/domain/evidence-risk";
import { resolveCredential } from "@/lib/runtime/client-runtime";

import type { ProviderAdapter } from "./types";

const actorByProvider = {
	apify_facebook_posts: "apify/facebook-posts-scraper",
	apify_facebook_comments: "apify/facebook-comments-scraper",
	apify_facebook_groups: "apify/facebook-groups-scraper",
} as const;

export function createApifyAdapter(
	provider: keyof typeof actorByProvider,
): ProviderAdapter {
	return async (source) => {
		const credential = resolveCredential(process.env.APIFY_TOKEN);
		if (!credential) {
			throw new Error("APIFY_TOKEN is required for Facebook source collection");
		}

		const client = new ApifyClient({ token: credential.value });
		const url = source.normalizedUrl ?? source.originalInput;
		const actorInput = buildActorInput(provider, url);
		const run = await client.actor(actorByProvider[provider]).call(actorInput);
		const { items } = await client
			.dataset<Record<string, unknown>>(run.defaultDatasetId)
			.listItems({ limit: 80, clean: true });

		return {
			provider,
			mode: "live",
			credentialSource: credential.source,
			raw: {
				runId: run.id,
				defaultDatasetId: run.defaultDatasetId,
				itemCount: items.length,
				items,
			},
			evidence: items.slice(0, 40).map((item) => normalizeApifyItem(item, url)),
		};
	};
}

function buildActorInput(provider: keyof typeof actorByProvider, url: string) {
	const base = {
		startUrls: [{ url }],
		resultsLimit: 25,
		maxPosts: 25,
		maxComments: 80,
		includeNestedComments: true,
	};

	if (provider === "apify_facebook_comments") {
		return {
			startUrls: [{ url }],
			maxComments: 80,
			maxReplies: 20,
			sortCommentsBy: "RANKED_UNFILTERED",
		};
	}

	if (provider === "apify_facebook_groups") {
		return {
			...base,
			maxPosts: 20,
			sortOrder: "CHRONOLOGICAL",
		};
	}

	return base;
}

function normalizeApifyItem(item: Record<string, unknown>, fallbackUrl: string) {
	const text = pickString(item, ["text", "postTitle", "caption", "message"]);
	const url = pickString(item, ["url", "commentUrl", "facebookUrl"]) ?? fallbackUrl;
	const author =
		pickString(item, ["profileName", "pageName"]) ??
		(typeof item.user === "object" && item.user
			? pickString(item.user as Record<string, unknown>, ["name"])
			: undefined);
	const comments = pickNumber(item, ["commentsCount", "commentCount"]);
	const shares = pickNumber(item, ["sharesCount", "shareCount"]);
	const reactions =
		pickNumber(item, ["likesCount", "reactionLikeCount", "topReactionsCount"]) ?? 0;
	const assessment = assessEvidenceRisk({
		comments,
		shares,
		text,
	});
	const originalImageUrl = pickOriginalImageUrl(item);

	return {
		sourceUrl: url,
		sourceLabel: "facebook.com",
		author: author ?? null,
		publishedAt: parseDate(pickString(item, ["date", "time"])),
		quote: text?.slice(0, 1200) || "Không có nội dung văn bản rõ ràng.",
		summary: text
			? text.slice(0, 220)
			: "Bằng chứng từ nguồn Facebook công khai.",
		engagement: { comments: comments ?? 0, shares: shares ?? 0, reactions },
		stance: "unknown",
		sentiment: "neutral",
		riskLevel: assessment.level,
		metadata: {
			facebookId: pickString(item, ["facebookId", "postId", "commentId", "id"]),
			originalImageUrl,
			riskReasons: assessment.reasons,
		},
	};
}

function pickString(item: Record<string, unknown>, keys: string[]) {
	for (const key of keys) {
		const value = item[key];
		if (typeof value === "string" && value.trim()) return value.trim();
		if (typeof value === "number") return String(value);
	}
}

function pickNumber(item: Record<string, unknown>, keys: string[]) {
	for (const key of keys) {
		const value = item[key];
		if (typeof value === "number") return value;
		if (typeof value === "string") {
			const parsed = Number(value.replace(/,/g, ""));
			if (Number.isFinite(parsed)) return parsed;
		}
	}
}

function parseDate(value?: string) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function pickOriginalImageUrl(item: Record<string, unknown>) {
	for (const key of [
		"imageUrl",
		"image",
		"photoUrl",
		"fullPicture",
		"thumbnailUrl",
	]) {
		const value = item[key];
		if (isRemoteImageUrl(value)) return value;
	}
	for (const key of ["media", "images", "attachments", "photos"]) {
		const found = findImageUrl(item[key], 0);
		if (found) return found;
	}
	return null;
}

function findImageUrl(value: unknown, depth: number): string | null {
	if (depth > 4 || !value) return null;
	if (isRemoteImageUrl(value)) return value;
	if (Array.isArray(value)) {
		for (const item of value.slice(0, 8)) {
			const found = findImageUrl(item, depth + 1);
			if (found) return found;
		}
		return null;
	}
	if (typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	for (const key of [
		"fullPicture",
		"imageUrl",
		"photoUrl",
		"thumbnailUrl",
		"uri",
		"url",
		"src",
	]) {
		if (isRemoteImageUrl(record[key])) return record[key];
	}
	for (const child of Object.values(record).slice(0, 12)) {
		const found = findImageUrl(child, depth + 1);
		if (found) return found;
	}
	return null;
}

function isRemoteImageUrl(value: unknown): value is string {
	if (typeof value !== "string") return false;
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			/\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#])/iu.test(url.href)
		);
	} catch {
		return false;
	}
}
