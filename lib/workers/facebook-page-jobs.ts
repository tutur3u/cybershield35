import "server-only";

import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { adminDb } from "@/lib/db/client";
import {
	draftAutomationJobs,
	evidenceItems,
	facebookPageProfiles,
	type EvidenceItemRow,
} from "@/lib/db/schema";
import {
	automatedDraftPolicy,
	facebookPageIdentity,
	type FacebookPageClassification,
} from "@/lib/domain/facebook-page-policy";

type Actor = { displayName: string | null; id: string };

export async function updateFacebookPagePolicy(input: {
	actor: Actor;
	autoDraftEnabled: boolean;
	classification: FacebookPageClassification;
	displayName: string;
	facebookPageId: string | null;
	pageKey: string;
	username: string | null;
}) {
	const now = new Date();
	const [matchingProfile] = await adminDb
		.select({ pageKey: facebookPageProfiles.pageKey })
		.from(facebookPageProfiles)
		.where(
			or(
				eq(facebookPageProfiles.pageKey, input.pageKey),
				input.facebookPageId
					? eq(facebookPageProfiles.facebookPageId, input.facebookPageId)
					: undefined,
				input.username
					? eq(facebookPageProfiles.username, input.username.toLowerCase())
					: undefined,
			),
		)
		.limit(1);
	const canonicalPageKey = matchingProfile?.pageKey ?? input.pageKey;
	const [profile] = await adminDb
		.insert(facebookPageProfiles)
		.values({
			autoDraftEnabled: input.autoDraftEnabled,
			classification: input.classification,
			displayName: input.displayName,
			facebookPageId: input.facebookPageId,
			pageKey: canonicalPageKey,
			updatedByDisplayName: input.actor.displayName,
			updatedByUserId: input.actor.id,
			username: input.username,
		})
		.onConflictDoUpdate({
			target: facebookPageProfiles.pageKey,
			set: {
				autoDraftEnabled: input.autoDraftEnabled,
				classification: input.classification,
				displayName: input.displayName,
				facebookPageId: input.facebookPageId,
				updatedAt: now,
				updatedByDisplayName: input.actor.displayName,
				updatedByUserId: input.actor.id,
				username: input.username,
			},
		})
		.returning();

	if (!profile) throw new Error("Không thể lưu phân loại fanpage.");
	if (!input.autoDraftEnabled || input.classification === "uncategorized") {
		await adminDb
			.update(draftAutomationJobs)
			.set({
				errorMessage: "Automation was disabled or the page was uncategorized.",
				status: "skipped",
				updatedAt: now,
			})
			.where(
				and(
					eq(draftAutomationJobs.pageKey, canonicalPageKey),
					inArray(draftAutomationJobs.status, ["queued", "retrying"]),
				),
			);
		return { enqueued: 0, profile };
	}

	const evidence = await evidenceForPage(input).limit(50);
	const enqueued = await enqueueEvidenceDraftJobs(evidence);
	return { enqueued, profile };
}

export async function enqueueEvidenceDraftJobs(
	evidence: Array<
		Pick<
			EvidenceItemRow,
			| "author"
			| "id"
			| "metadata"
			| "riskLevel"
			| "sentiment"
			| "sourceUrl"
			| "stance"
		>
	>,
) {
	const identities = evidence.map((item) => ({
		identity: facebookPageIdentity({
			author: item.author,
			facebookPageId: item.metadata?.facebookId,
			sourceUrl: item.sourceUrl,
		}),
		item,
	}));
	const pageKeys = [
		...new Set(
			identities
				.map(({ identity }) => identity.pageKey)
				.filter((value): value is string => Boolean(value)),
		),
	];
	const facebookPageIds = [
		...new Set(
			identities
				.map(({ identity }) => identity.facebookPageId)
				.filter((value): value is string => Boolean(value)),
		),
	];
	const usernames = [
		...new Set(
			identities
				.map(({ identity }) => identity.username)
				.filter((value): value is string => Boolean(value)),
		),
	];
	if (!pageKeys.length) return 0;

	const profiles = await adminDb
		.select()
		.from(facebookPageProfiles)
		.where(
			and(
				or(
					inArray(facebookPageProfiles.pageKey, pageKeys),
					facebookPageIds.length
						? inArray(facebookPageProfiles.facebookPageId, facebookPageIds)
						: undefined,
					usernames.length
						? inArray(facebookPageProfiles.username, usernames)
						: undefined,
				),
				eq(facebookPageProfiles.autoDraftEnabled, true),
			),
		);
	const byKey = new Map(profiles.map((profile) => [profile.pageKey, profile]));
	const byFacebookPageId = new Map(
		profiles.flatMap((profile) =>
			profile.facebookPageId ? [[profile.facebookPageId, profile] as const] : [],
		),
	);
	const byUsername = new Map(
		profiles.flatMap((profile) =>
			profile.username ? [[profile.username, profile] as const] : [],
		),
	);
	const jobs = identities.flatMap(({ identity, item }) => {
		if (!identity.pageKey) return [];
		const profile =
			byKey.get(identity.pageKey) ??
			(identity.facebookPageId
				? byFacebookPageId.get(identity.facebookPageId)
				: undefined) ??
			(identity.username ? byUsername.get(identity.username) : undefined);
		if (!profile) return [];
		const policy = automatedDraftPolicy({
			classification: profile.classification,
			riskLevel: item.riskLevel,
			sentiment: item.sentiment,
			stance: item.stance,
		});
		if (!policy) return [];
		return [
			{
				classification: profile.classification,
				draftKind: policy.draftKind,
				evidenceItemId: item.id,
				pageKey: profile.pageKey,
			},
		];
	});
	if (!jobs.length) return 0;

	const created = await adminDb
		.insert(draftAutomationJobs)
		.values(jobs)
		.onConflictDoNothing({
			target: [
				draftAutomationJobs.evidenceItemId,
				draftAutomationJobs.classification,
			],
		})
		.returning({ id: draftAutomationJobs.id });
	return created.length;
}

function evidenceForPage(input: {
	classification: FacebookPageClassification;
	facebookPageId: string | null;
	username: string | null;
}) {
	const identityCondition = or(
		input.facebookPageId
			? sql`${evidenceItems.metadata}->>'facebookId' = ${input.facebookPageId}`
			: undefined,
		input.username
			? or(
					eq(sql`lower(${evidenceItems.author})`, input.username.toLowerCase()),
					ilike(evidenceItems.sourceUrl, `%facebook.com/${input.username}%`),
				)
			: undefined,
	);
	return adminDb
		.select({
			author: evidenceItems.author,
			id: evidenceItems.id,
			metadata: evidenceItems.metadata,
			riskLevel: evidenceItems.riskLevel,
			sentiment: evidenceItems.sentiment,
			sourceUrl: evidenceItems.sourceUrl,
			stance: evidenceItems.stance,
		})
		.from(evidenceItems)
		.where(
			and(
				eq(evidenceItems.provider, "apify_facebook_posts"),
				identityCondition,
			),
		)
		.orderBy(desc(evidenceItems.publishedAt), desc(evidenceItems.createdAt));
}
