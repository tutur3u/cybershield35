/**
 * How a followed page is named on screen: the team's name, then its handle.
 *
 * Every surface that showed a page — timeline cards, the dense list, the scan
 * queue, evidence detail — picked its own field, so the same page appeared as
 * "Việt Tân" in one place and "viettan" in another and a reader had no way to
 * know they were the same account. One resolver, used everywhere, means the
 * name is stable and the handle is always available to confirm it.
 */

export type PageIdentity = {
	/** The account handle, without the `@`. Null when it adds nothing. */
	handle: string | null;
	/** What to lead with. Never empty. */
	name: string;
};

/** The handle in a Facebook page URL — `.../viettan?ref=x` gives `viettan`. */
export function facebookHandleFromUrlText(value: string | null | undefined) {
	if (!value) return null;
	try {
		const url = new URL(value);
		if (!/(^|\.)facebook\.com$/iu.test(url.hostname)) return null;
		return cleanHandle(url.pathname.split("/").filter(Boolean)[0]);
	} catch {
		return null;
	}
}

/**
 * Resolves the pair to show, in the order the fields deserve to be trusted.
 *
 * `displayName` comes first because it is the only one a person edits. The
 * handle is dropped when it merely repeats the name, which would otherwise
 * print the same word twice with an `@` in front of the second — the exact
 * shape the timeline had before, where the name was the handle and the handle
 * was then suppressed as a duplicate, leaving no name at all.
 */
export function pageIdentity(input: {
	author?: string | null;
	displayName?: string | null;
	fallback?: string | null;
	handle?: string | null;
	sourceUrl?: string | null;
}): PageIdentity {
	const handle =
		cleanHandle(input.handle) ??
		cleanHandle(input.author) ??
		facebookHandleFromUrlText(input.sourceUrl);
	/*
	 * No `sourceLabel` in this chain on purpose. Evidence rows carry
	 * "facebook.com" there, which outranked every real name and was for a long
	 * time the loudest line on every card. A caller with a genuine name passes
	 * it as `displayName`.
	 */
	const name =
		clean(input.displayName) ??
		handle ??
		clean(input.author) ??
		clean(input.fallback) ??
		"Nguồn chưa đặt tên";

	return {
		handle: handle && handle.toLowerCase() !== name.toLowerCase() ? handle : null,
		name,
	};
}

function clean(value: string | null | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function cleanHandle(value: string | null | undefined) {
	const trimmed = clean(value)?.replace(/^@/u, "");
	if (!trimmed) return null;
	// A numeric page id is not a handle a reader can type or recognise.
	if (/^\d+$/u.test(trimmed)) return null;
	// A full URL means the field held something other than a handle.
	if (/[\s/]/u.test(trimmed)) return null;
	return trimmed;
}
