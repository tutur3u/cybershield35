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
 * Nothing reaches the Zalo Official Account — not even as a hidden draft — until
 * an editor has approved the article and published it from the editor.
 *
 * Staging hidden drafts ahead of review was tried and withdrawn: every unapproved
 * article ended up sitting in the OA's content manager, which is someone else's
 * workspace to keep tidy. `hide` is the one exception and must never be blocked,
 * because pulling something back has to stay possible at any moment.
 */
function operationWithdrawsContent(operation: ArticlePublicationOperation) {
	return operation === "hide";
}

export function reviewAllowsArticleOperation(
	reviewStatus: ArticleReviewStatus,
	operation: ArticlePublicationOperation,
) {
	if (operationWithdrawsContent(operation)) return true;
	return reviewStatus === "approved";
}

export function publicationStateAllowsArticleOperation(
	state: ArticleState,
	operation: ArticlePublicationOperation,
) {
	if (operationWithdrawsContent(operation)) return true;
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
