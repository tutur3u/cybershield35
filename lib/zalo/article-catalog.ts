export type ZaloCatalogArticle = {
	author: string | null;
	coverUrl: string | null;
	createdAt: string | null;
	description: string;
	metrics: {
		comments: number;
		likes: number;
		shares: number;
		views: number;
	};
	oaConnectionId: string;
	oaDisplayName: string;
	oaId: string;
	publicationStatus: "failed" | "hidden" | "published" | "remote_draft";
	publishedAt: string | null;
	remoteArticleId: string;
	title: string;
	updatedAt: string | null;
};

type ZaloCatalogAccount = {
	connectionId: string;
	displayName: string;
	oaId: string;
};

export function normalizeZaloArticleList(
	payload: unknown,
	account: ZaloCatalogAccount,
): ZaloCatalogArticle[] {
	const items = articleItems(payload);
	return items.flatMap((value) => {
		const item = objectValue(value);
		const remoteArticleId =
			stringValue(item.id) ??
			stringValue(item.article_id) ??
			stringValue(item.media_id);
		if (!remoteArticleId) return [];

		const cover = objectValue(item.cover);
		return [
			{
				author: stringValue(item.author),
				coverUrl:
					stringValue(cover.photo_url) ??
					stringValue(cover.cover_url) ??
					stringValue(cover.url) ??
					stringValue(item.cover_url) ??
					stringValue(item.thumbnail) ??
					stringValue(item.thumb),
				createdAt: dateValue(
					item.create_date ?? item.created_at ?? item.created_time,
				),
				description:
					stringValue(item.description) ?? stringValue(item.summary) ?? "",
				metrics: {
					comments: numberValue(
						item.comment_count ?? item.comments ?? item.total_comment,
					),
					likes: numberValue(
						item.like_count ?? item.likes ?? item.total_like,
					),
					shares: numberValue(
						item.share_count ?? item.shares ?? item.total_share,
					),
					views: numberValue(
						item.view_count ?? item.views ?? item.total_view,
					),
				},
				oaConnectionId: account.connectionId,
				oaDisplayName: account.displayName,
				oaId: account.oaId,
				publicationStatus: normalizeZaloPublicationStatus(item.status),
				publishedAt: dateValue(
					item.publish_date ?? item.published_at ?? item.publish_time,
				),
				remoteArticleId,
				title:
					stringValue(item.title) ??
					stringValue(item.name) ??
					"Bài viết Zalo chưa đặt tên",
				updatedAt: dateValue(
					item.update_date ?? item.updated_at ?? item.modified_time,
				),
			},
		];
	});
}

export function normalizeZaloPublicationStatus(
	value: unknown,
): ZaloCatalogArticle["publicationStatus"] {
	const status = String(value ?? "")
		.trim()
		.toLowerCase();
	if (
		["show", "shown", "publish", "published", "active", "visible"].includes(
			status,
		)
	) {
		return "published";
	}
	if (
		["draft", "pending", "new", "nháp", "nhap"].includes(status)
	) {
		return "remote_draft";
	}
	if (["failed", "rejected", "error"].includes(status)) return "failed";
	return "hidden";
}

export function zaloArticleListTotal(payload: unknown) {
	const root = objectValue(payload);
	const data = objectValue(root.data);
	const raw = data.total ?? root.total;
	if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
		return Math.round(raw);
	}
	if (typeof raw === "string" && /^\d+$/u.test(raw.trim())) {
		return Number(raw);
	}
	return null;
}

function articleItems(payload: unknown): unknown[] {
	const root = objectValue(payload);
	const data = root.data;
	if (Array.isArray(data)) return data;
	const dataRecord = objectValue(data);
	for (const key of ["medias", "articles", "items", "data"]) {
		const value = dataRecord[key];
		if (Array.isArray(value)) return value;
	}
	for (const key of ["medias", "articles", "items"]) {
		const value = root[key];
		if (Array.isArray(value)) return value;
	}
	return [];
}

function objectValue(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function stringValue(value: unknown) {
	if (typeof value === "string" && value.trim()) return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return null;
}

function numberValue(value: unknown) {
	const numeric =
		typeof value === "number"
			? value
			: typeof value === "string"
				? Number(value.replaceAll(".", "").replace(",", "."))
				: 0;
	return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
}

function dateValue(value: unknown) {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString();
	}
	if (typeof value === "number" || /^\d+$/u.test(String(value ?? ""))) {
		const numeric = Number(value);
		if (!Number.isFinite(numeric) || numeric <= 0) return null;
		const milliseconds = numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
		const date = new Date(milliseconds);
		return Number.isNaN(date.getTime()) ? null : date.toISOString();
	}
	if (typeof value !== "string" || !value.trim()) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
