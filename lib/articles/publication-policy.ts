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

export function reviewAllowsArticleOperation(
	reviewStatus: ArticleReviewStatus,
	operation: ArticlePublicationOperation,
) {
	void operation;
	return reviewStatus === "approved";
}

/**
 * Nothing reaches the Zalo Official Account until an editor has both approved the
 * article and published it from the editor. Hiding stays available so a live post
 * can always be pulled back.
 */
export function publicationStateAllowsArticleOperation(
	state: ArticleState,
	operation: ArticlePublicationOperation,
) {
	if (operation === "hide") return true;
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
