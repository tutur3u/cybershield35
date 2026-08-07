import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import type { IntelligenceFacebookPageOption } from "@/components/dashboard/types";
import { adminDb } from "@/lib/db/client";
import {
	evidenceItems,
	facebookPageProfiles,
	trackedSources,
} from "@/lib/db/schema";
import { facebookPageIdentity } from "@/lib/domain/facebook-page-policy";
import { ensureFacebookPageTracked } from "@/lib/workers/tracked-sources";

export async function listIntelligenceFacebookPages(): Promise<
	IntelligenceFacebookPageOption[]
> {
	const facebookIdExpr = sql<string | null>`${evidenceItems.metadata}->>'facebookId'`;
	const [evidenceRows, trackedRows, profiles] = await Promise.all([
		adminDb
			.select({
				evidenceCount: sql<number>`count(*)::int`,
				facebookId: facebookIdExpr,
				lastSeenAt: sql<Date | null>`max(${evidenceItems.createdAt})`,
				username: evidenceItems.author,
			})
			.from(evidenceItems)
			.where(eq(evidenceItems.provider, "apify_facebook_posts"))
			.groupBy(evidenceItems.author, facebookIdExpr)
			.orderBy(sql`count(*) desc`),
		adminDb
			.select({
				displayName: trackedSources.displayName,
				id: trackedSources.id,
				lastScannedAt: trackedSources.lastScannedAt,
				metadata: trackedSources.metadata,
				normalizedUrl: trackedSources.normalizedUrl,
			})
			.from(trackedSources)
			.where(eq(trackedSources.provider, "apify_facebook_posts"))
			.orderBy(desc(trackedSources.updatedAt)),
		adminDb.select().from(facebookPageProfiles),
	]);
	const profileByKey = new Map(profiles.map((profile) => [profile.pageKey, profile]));
	const profileByFacebookId = new Map(
		profiles.flatMap((profile) =>
			profile.facebookPageId ? [[profile.facebookPageId, profile] as const] : [],
		),
	);
	const profileByUsername = new Map(
		profiles.flatMap((profile) =>
			profile.username ? [[profile.username, profile] as const] : [],
		),
	);
	const pagesByKey = new Map<string, IntelligenceFacebookPageOption>();

	for (const row of evidenceRows) {
		const username = cleanFacebookUsername(row.username);
		const identity = facebookPageIdentity({
			author: username,
			facebookPageId: row.facebookId,
		});
		if (!identity.pageKey) continue;
		const profile =
			profileByKey.get(identity.pageKey) ??
			(identity.facebookPageId
				? profileByFacebookId.get(identity.facebookPageId)
				: undefined) ??
			(identity.username ? profileByUsername.get(identity.username) : undefined);
		const pageKey = profile?.pageKey ?? identity.pageKey;
		const value = username ?? cleanText(row.facebookId) ?? identity.pageKey;
		pagesByKey.set(pageKey, {
			classification: profile?.classification ?? "uncategorized",
			evidenceCount: Number(row.evidenceCount) || 0,
			facebookId: cleanText(row.facebookId),
			href: `/evidence?facebookPage=${encodeURIComponent(value)}`,
			label: username ?? `Facebook ID ${row.facebookId}`,
			lastSeenAt: toIsoOrNull(row.lastSeenAt),
			pageKey,
			sourceUrl: username ? `https://www.facebook.com/${username}` : null,
			trackedSourceId: null,
			username,
			value,
		});
	}

	for (const row of trackedRows) {
		const metadataLabel =
			typeof row.metadata?.label === "string" ? row.metadata.label : null;
		const username =
			cleanFacebookUsername(metadataLabel) ??
			usernameFromFacebookUrl(row.normalizedUrl);
		const identity = facebookPageIdentity({
			author: username,
			sourceUrl: row.normalizedUrl,
		});
		const matchingEvidencePage = [...pagesByKey.values()].find(
			(page) => username && page.username === username,
		);
		const matchingProfile =
			(identity.pageKey ? profileByKey.get(identity.pageKey) : undefined) ??
			(username ? profileByUsername.get(username) : undefined);
		const pageKey =
			matchingEvidencePage?.pageKey ??
			matchingProfile?.pageKey ??
			identity.pageKey ??
			`tracked:${row.id}`;
		const value = username ?? row.id;
		const current = pagesByKey.get(pageKey) ?? matchingEvidencePage;
		const profile = matchingProfile ?? profileByKey.get(pageKey);
		pagesByKey.set(pageKey, {
			classification: profile?.classification ?? "uncategorized",
			evidenceCount: current?.evidenceCount ?? 0,
			facebookId: current?.facebookId ?? null,
			href: `/evidence?facebookPage=${encodeURIComponent(value)}`,
			label: row.displayName,
			lastSeenAt: current?.lastSeenAt ?? toIsoOrNull(row.lastScannedAt),
			pageKey,
			sourceUrl: row.normalizedUrl,
			trackedSourceId: row.id,
			username,
			value,
		});
	}

	for (const page of pagesByKey.values()) {
		if (page.trackedSourceId) continue;
		const tracked = await ensureFacebookPageTracked({
			displayName: page.label,
			facebookPageId: page.facebookId,
			pageKey: page.pageKey,
			sourceUrl: page.sourceUrl,
			username: page.username,
		});
		page.trackedSourceId = tracked.id;
		page.sourceUrl = tracked.normalizedUrl;
	}

	return [...pagesByKey.values()].sort(
		(left, right) =>
			right.evidenceCount - left.evidenceCount ||
			left.label.localeCompare(right.label, "vi"),
	);
}

export async function reconcileFacebookPageSources() {
	const pages = await listIntelligenceFacebookPages();
	return {
		reconciled: pages.filter((page) => Boolean(page.trackedSourceId)).length,
		total: pages.length,
	};
}

export function facebookUsernameFromEvidence(
	author: string | null,
	sourceUrl: string | null,
): string | null {
	return cleanFacebookUsername(author) ?? usernameFromFacebookUrl(sourceUrl);
}

function usernameFromFacebookUrl(value?: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		if (!/(^|\.)facebook\.com$/iu.test(url.hostname)) return null;
		return cleanFacebookUsername(url.pathname.split("/").filter(Boolean)[0]);
	} catch {
		return null;
	}
}

function cleanFacebookUsername(value?: string | null): string | null {
	const cleaned = cleanText(value);
	if (!cleaned) return null;
	if (/^\d+$/u.test(cleaned)) return null;
	if (/facebook\.com/iu.test(cleaned)) return usernameFromFacebookUrl(cleaned);
	return cleaned.replace(/^@/u, "");
}

function cleanText(value?: string | null): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed.slice(0, 160) : null;
}

function toIsoOrNull(value: Date | string | null): string | null {
	if (!value) return null;
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
