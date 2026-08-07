import "server-only";

import { eq, or } from "drizzle-orm";

import { adminDb } from "@/lib/db/client";
import { facebookPageProfiles } from "@/lib/db/schema";
import type { FacebookPageClassification } from "@/lib/domain/facebook-page-policy";

type Actor = { displayName: string | null; id: string };

export async function updateFacebookPagePolicy(input: {
	actor: Actor;
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
			autoDraftEnabled: false,
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
				autoDraftEnabled: false,
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
	return { enqueued: 0, profile };
}
