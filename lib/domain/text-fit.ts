/**
 * Deterministic text fitting for the fields that carry a hard character cap
 * (titles, excerpts, evidence summaries).
 *
 * A plain `slice()` cuts Vietnamese mid-word and leaves the reader with a
 * dangling function word — "Chính phủ công bố chính sách mới về" — which reads as
 * broken rather than shortened. This module always lands on a real boundary:
 * a complete sentence when one fits, then a clause, then a whole word, and it
 * refuses to end on a connective.
 *
 * The LLM rewriter in `lib/llm/text-fitting.ts` is preferred when a field is over
 * its cap; this is the floor that runs everywhere else and whenever the model is
 * unavailable.
 */

const SENTENCE_PATTERN = /[^.!?…]+[.!?…]+(?:["”’)\]]*)/gu;
const CLAUSE_SEPARATORS = /[,;:–—]/u;

/**
 * Function words that must never be the last word of a shortened phrase. Ending
 * on one of these is what makes a clip read as an accident.
 */
const DANGLING_WORDS = new Set([
	"bằng",
	"bởi",
	"các",
	"cho",
	"chứ",
	"còn",
	"cùng",
	"của",
	"do",
	"dù",
	"gồm",
	"giữa",
	"hay",
	"hoặc",
	"khi",
	"khoảng",
	"là",
	"lên",
	"mà",
	"mỗi",
	"một",
	"nên",
	"nếu",
	"như",
	"nhưng",
	"những",
	"ngoài",
	"qua",
	"ra",
	"rằng",
	"sau",
	"sẽ",
	"tại",
	"theo",
	"thì",
	"trên",
	"trong",
	"trước",
	"từ",
	"tới",
	"và",
	"vào",
	"về",
	"vì",
	"với",
	"xuống",
	"đang",
	"đã",
	"để",
	"đến",
	"đối",
]);

export type TextFitOptions = {
	/** Append an ellipsis when content was dropped mid-thought. */
	ellipsis?: boolean;
	/** Shortest acceptable result; below this the caller should try another source. */
	minLength?: number;
	/** Prefer stopping at the first sentence once this length is reached. */
	preferredLength?: number;
};

/**
 * Shortens `value` to at most `limit` characters without cutting a word, a
 * multi-byte character, or a thought in half.
 */
export function fitTextToLimit(
	value: string,
	limit: number,
	options: TextFitOptions = {},
): string {
	const normalized = collapseWhitespace(value);
	if (!normalized) return "";
	if (normalized.length <= limit) return normalized;

	const minLength = options.minLength ?? Math.min(20, Math.floor(limit * 0.3));

	const bySentence = fitBySentence(normalized, limit, options.preferredLength);
	if (bySentence.length >= minLength) return bySentence;

	const byClause = trimDangling(fitByClause(normalized, limit));
	if (byClause.length >= minLength) {
		return options.ellipsis ? withEllipsis(byClause, limit) : byClause;
	}

	const byWord = trimDangling(fitByWord(normalized, limit));
	if (!byWord) return normalized.slice(0, limit).trim();
	return options.ellipsis ? withEllipsis(byWord, limit) : byWord;
}

/**
 * True when the text already fits and does not end mid-thought, so callers can
 * skip an LLM round trip.
 */
export function isCleanlyFitted(value: string, limit: number) {
	const normalized = collapseWhitespace(value);
	if (!normalized || normalized.length > limit) return false;
	if (/[…]$/u.test(normalized)) return false;
	return !endsWithDanglingWord(normalized);
}

export function collapseWhitespace(value: string) {
	return value.replace(/\s+/gu, " ").trim();
}

function fitBySentence(value: string, limit: number, preferredLength?: number) {
	const sentences = value.match(SENTENCE_PATTERN) ?? [];
	let result = "";
	for (const sentence of sentences) {
		const candidate = `${result} ${sentence.trim()}`.trim();
		if (candidate.length > limit) break;
		result = candidate;
		if (preferredLength && result.length >= preferredLength) break;
	}
	return result;
}

function fitByClause(value: string, limit: number) {
	const head = value.slice(0, limit + 1);
	let cut = -1;
	for (let index = head.length - 1; index >= 0; index -= 1) {
		const character = head[index]!;
		if (CLAUSE_SEPARATORS.test(character)) {
			cut = index;
			break;
		}
	}
	if (cut < Math.floor(limit * 0.45)) return "";
	return head.slice(0, cut).trim();
}

function fitByWord(value: string, limit: number) {
	const head = value.slice(0, limit + 1);
	const lastSpace = head.lastIndexOf(" ");
	if (lastSpace <= 0) return "";
	return head.slice(0, lastSpace).trim();
}

function trimDangling(value: string) {
	let result = value.replace(/[\s,;:–—-]+$/u, "").trim();
	// Peel connectives one at a time; "chính sách mới về và" needs two passes.
	for (let pass = 0; pass < 3; pass += 1) {
		if (!endsWithDanglingWord(result)) break;
		const lastSpace = result.lastIndexOf(" ");
		if (lastSpace <= 0) return "";
		result = result.slice(0, lastSpace).replace(/[\s,;:–—-]+$/u, "").trim();
	}
	return endsWithDanglingWord(result) ? "" : result;
}

function endsWithDanglingWord(value: string) {
	const lastWord = value
		.split(/\s+/u)
		.at(-1)
		?.replace(/[^\p{L}\p{N}]/gu, "")
		.toLocaleLowerCase("vi-VN");
	return Boolean(lastWord && DANGLING_WORDS.has(lastWord));
}

function withEllipsis(value: string, limit: number) {
	if (/[.!?…]$/u.test(value)) return value;
	const room = limit - value.length;
	if (room >= 1) return `${value}…`;
	return trimDangling(fitByWord(value, limit - 1)) || value.slice(0, limit - 1);
}
