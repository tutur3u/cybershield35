export type ArticleReviewStatus =
	| "approved"
	| "draft"
	| "needs_review"
	| "rejected";

export type ArticlePublicationOperation =
	| "hide"
	| "publish"
	| "sync_hidden"
	| "update_visible";

export type ArticleState = "archived" | "draft" | "published";

/**
 * Only the operations that put an article in front of an audience are gated.
 *
 * `sync_hidden` uploads a draft that Zalo keeps hidden — no follower can see it,
 * and it is exactly what the automation exists to do so a reviewer opens an
 * article that is already staged. `hide` withdraws a live post and must never be
 * blocked. Requiring approval for those two made the automation impossible and
 * stamped a publish failure on every article it touched, which is what surfaced
 * as "Đăng lỗi" across the whole list.
 */
function operationReachesAudience(operation: ArticlePublicationOperation) {
	return operation === "publish" || operation === "update_visible";
}

export function reviewAllowsArticleOperation(
	reviewStatus: ArticleReviewStatus,
	operation: ArticlePublicationOperation,
) {
	if (!operationReachesAudience(operation)) {
		// A rejected article is a deliberate "no", so it is not staged either.
		return reviewStatus !== "rejected";
	}
	return reviewStatus === "approved";
}

/**
 * Nothing becomes visible on the Zalo Official Account until an editor has both
 * approved the article and published it from the editor. Staging a hidden draft
 * and pulling a live post back stay available at any state.
 */
export function publicationStateAllowsArticleOperation(
	state: ArticleState,
	operation: ArticlePublicationOperation,
) {
	if (!operationReachesAudience(operation)) return state !== "archived";
	return state === "published";
}

export function actorAllowsArticleOperation(
	actorUserId: string,
	operation: ArticlePublicationOperation,
) {
	return (
		actorUserId !== "system" ||
		(operation !== "publish" && operation !== "update_visible")
	);
}
