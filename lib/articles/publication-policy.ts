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
	if (operation === "sync_hidden") return reviewStatus !== "rejected";
	return reviewStatus === "approved";
}
