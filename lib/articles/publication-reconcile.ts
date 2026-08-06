/**
 * What an article's Zalo status should say once a review decision is made.
 *
 * The queue can leave an article carrying `failed` or `syncing` from a request
 * the approval gate refused before anything reached Zalo. Carrying that past a
 * review would greet the approver with "Đăng lỗi" for a publish nobody
 * attempted.
 *
 * Kept as a pure function rather than a SQL `case` in the update: the first
 * attempt wrote the cast by hand, named an enum type that does not exist, and
 * broke approval outright — while a test that matched the SQL as source text
 * went on passing. Plain code cannot get the type name wrong, and this can be
 * tested for what it decides.
 */

/** Statuses that describe an intent to reach Zalo, not a state Zalo holds. */
const STALE_INTENT = ["failed", "publishing", "scheduled", "syncing"];

export type PublicationReconcileInput = {
	lastError: string | null;
	publicationStatus: string;
	remoteArticleId: string | null;
	/** The status *before* the decision being applied. */
	reviewStatus: string;
};

export function reconcilePublicationOnReview(
	input: PublicationReconcileInput,
): {
	lastError?: null;
	publicationStatus?: "hidden" | "not_synced";
} | null {
	// An approved article's failure is a real one; it is not swept away because
	// somebody touched the review status.
	if (input.reviewStatus === "approved") return null;

	// The stored error on an unapproved article is the refusal itself. It goes
	// whether or not the status went with it, because there is no attempt it
	// could be describing.
	const clearError = input.lastError ? { lastError: null as null } : null;
	if (!STALE_INTENT.includes(input.publicationStatus)) return clearError;

	return {
		...clearError,
		lastError: null,
		// An article with a draft on the OA keeps saying so — that part is true.
		publicationStatus: input.remoteArticleId ? "hidden" : "not_synced",
	};
}

/**
 * Whether a stored Zalo error is worth showing.
 *
 * Only an approved article can have had a publish attempted, so on anything
 * else a stored error is the approval gate's own refusal — shown to the
 * operator it reads as "your publish failed" for something they never asked
 * for, right beside the button that would have asked.
 */
export function visiblePublicationError(input: {
	lastError: string | null;
	reviewStatus: string;
}) {
	return input.reviewStatus === "approved" ? input.lastError : null;
}
