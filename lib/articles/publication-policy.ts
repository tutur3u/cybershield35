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

export function reviewAllowsArticleOperation(
	reviewStatus: ArticleReviewStatus,
	operation: ArticlePublicationOperation,
) {
	void operation;
	return reviewStatus === "approved";
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
