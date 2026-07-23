import { DEFAULT_DRAFT_VOICE } from "@/lib/domain/draft-style";

export type FacebookPageClassification =
	| "uncategorized"
	| "trusted"
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

export function automatedDraftPolicy(input: {
	classification: FacebookPageClassification;
	riskLevel: "low" | "medium" | "high";
	sentiment?: string | null;
	stance?: string | null;
}):
	| {
			audience: string;
			draftKind: "response" | "counter_argument";
			generationReason: string;
			operatorNotes: string;
			tone: string;
			voice: string;
	  }
	| null {
	if (input.classification === "at_risk") {
		return {
			audience: "Công chúng chung",
			draftKind: "counter_argument",
			generationReason: "at_risk_page",
			operatorNotes:
				"Kiểm tra từng tuyên bố, phản biện bằng đúng bằng chứng được cung cấp và nêu rõ điều chưa thể xác minh. Không suy diễn chỉ dựa trên phân loại nguồn.",
			tone: "Bình tĩnh, chính xác, tôn trọng",
			voice: DEFAULT_DRAFT_VOICE,
		};
	}

	const looksConstructive =
		input.riskLevel === "low" ||
		input.sentiment === "positive" ||
		input.stance === "supportive";
	if (input.classification !== "trusted" || !looksConstructive) return null;

	return {
		audience: "Công chúng chung",
		draftKind: "response",
		generationReason: "trusted_constructive_content",
		operatorNotes:
			"Soạn nội dung chia sẻ tích cực, tóm lược giá trị thông tin và giữ nguyên các giới hạn của bằng chứng. Không thêm tuyên bố mới.",
		tone: "Tích cực, rõ ràng, hữu ích",
		voice: DEFAULT_DRAFT_VOICE,
	};
}

export function facebookPageClassificationLabel(
	classification: FacebookPageClassification,
) {
	if (classification === "trusted") return "Đáng tin cậy";
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
