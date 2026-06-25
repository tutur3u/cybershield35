import type { ProviderName, SourceType } from "@/lib/db/schema";

export type DetectionResult = {
	type: SourceType;
	provider: ProviderName;
	normalizedInput: string;
	label: string;
};

const facebookHostPattern = /(^|\.)facebook\.com$/i;
const postPathPattern =
	/(\/posts\/|\/permalink\/|\/reel\/|\/reels\/|\/videos\/|\/photo\/|story_fbid=|comment_id=|pfbid)/i;

export function detectSource(
	input: string,
	options?: { fileName?: string; mimeType?: string },
): DetectionResult {
	const trimmed = input.trim();

	if (options?.fileName || options?.mimeType) {
		const mime = options.mimeType ?? "";
		const fileName = options.fileName ?? "Uploaded file";
		return {
			type: "file",
			provider:
				mime.includes("pdf") ||
				mime.includes("word") ||
				mime.includes("officedocument")
					? "firecrawl_parse"
					: "local_text",
			normalizedInput: fileName,
			label: fileName,
		};
	}

	const url = toUrl(trimmed);
	if (!url) {
		return {
			type: "text",
			provider: "local_text",
			normalizedInput: trimmed,
			label: "Văn bản nhập thủ công",
		};
	}

	if (facebookHostPattern.test(url.hostname)) {
		if (url.pathname.includes("/groups/")) {
			return {
				type: "facebook_group",
				provider: "apify_facebook_groups",
				normalizedInput: url.toString(),
				label: "Facebook group",
			};
		}

		if (postPathPattern.test(`${url.pathname}${url.search}`)) {
			return {
				type: "facebook_post",
				provider: "apify_facebook_comments",
				normalizedInput: url.toString(),
				label: "Facebook post",
			};
		}

		return {
			type: "facebook_page",
			provider: "apify_facebook_posts",
			normalizedInput: url.toString(),
			label: facebookPageLabel(url),
		};
	}

	return {
		type: "url",
		provider: "firecrawl",
		normalizedInput: url.toString(),
		label: url.hostname.replace(/^www\./, ""),
	};
}

function facebookPageLabel(url: URL) {
	const handle = url.pathname.split("/").filter(Boolean)[0];
	return handle || "Facebook page";
}

function toUrl(input: string) {
	try {
		return new URL(input);
	} catch {
		try {
			return new URL(`https://${input}`);
		} catch {
			return null;
		}
	}
}
