export type FacebookPageClassification =
	| "uncategorized"
	| "trusted"
	| "neutral"
	| "at_risk";

export type FacebookPageIdentity = {
	facebookPageId: string | null;
	pageKey: string | null;
	username: string | null;
};

export function facebookPageIdentity(input: {
	author?: string | null;
	facebookPageId?: unknown;
	sourceUrl?: string | null;
}): FacebookPageIdentity {
	const facebookPageId = cleanIdentityPart(input.facebookPageId);
	const username =
		cleanFacebookUsername(input.author) ?? usernameFromFacebookUrl(input.sourceUrl);
	return {
		facebookPageId,
		pageKey: facebookPageId
			? `id:${facebookPageId}`
			: username
				? `username:${username}`
				: null,
		username,
	};
}

export function facebookPageClassificationLabel(
	classification: FacebookPageClassification,
) {
	if (classification === "trusted") return "Đáng tin cậy";
	if (classification === "neutral") return "Trung lập";
	if (classification === "at_risk") return "Có rủi ro";
	return "Chưa phân loại";
}

function cleanIdentityPart(value: unknown) {
	if (typeof value !== "string" && typeof value !== "number") return null;
	const cleaned = String(value).trim();
	return cleaned ? cleaned.slice(0, 200) : null;
}

function cleanFacebookUsername(value?: string | null) {
	const cleaned = value
		?.trim()
		.replace(/^@/u, "")
		.replace(/\s+/gu, "")
		.toLowerCase();
	if (!cleaned || cleaned.includes("facebook.com") || cleaned.length > 100) {
		return null;
	}
	return /^[\p{L}\p{N}._-]+$/u.test(cleaned) ? cleaned : null;
}

function usernameFromFacebookUrl(value?: string | null) {
	if (!value) return null;
	try {
		const url = new URL(value);
		if (!/(^|\.)facebook\.com$/iu.test(url.hostname)) return null;
		const segment = url.pathname.split("/").filter(Boolean)[0];
		if (!segment || ["groups", "posts", "share", "watch"].includes(segment)) {
			return null;
		}
		return cleanFacebookUsername(segment);
	} catch {
		return null;
	}
}
