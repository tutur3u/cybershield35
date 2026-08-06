import "server-only";

import { eq } from "drizzle-orm";

import {
	buildTuturuuuApiUrl,
	describeAccessTokenClaims,
	getSessionGrantedScopes,
	type TuturuuuAdminSession,
} from "@/lib/auth/tuturuuu-session";
import { adminDb } from "@/lib/db/client";
import { logOperation } from "@/lib/operations/telemetry";
import { articleMedia, articles } from "@/lib/db/schema";

const COLLECTION_SLUG = "article-media";

type CmsCollection = { id: string; slug: string };
type CmsEntry = { id: string };
type CmsAsset = { id: string };

export async function uploadArticleCmsMedia(input: {
	altText?: string;
	articleId: string;
	caption?: string;
	file: File;
	kind: "cover" | "inline";
	session: TuturuuuAdminSession;
	requestOrigin: string;
}) {
	if (!input.file.type.startsWith("image/")) throw new Error("Chỉ chấp nhận tệp ảnh.");
	if (input.file.size <= 0 || input.file.size > 10 * 1024 * 1024) {
		throw new Error("Ảnh phải có dung lượng từ 1 byte đến 10 MB.");
	}
	const [article] = await adminDb.select().from(articles).where(eq(articles.id, input.articleId)).limit(1);
	if (!article) throw new Error("Không tìm thấy bài viết.");
	const entryId = article.cmsEntryId ?? await createArticleMediaEntry(input.session, article);

	const upload = new FormData();
	upload.set("collectionType", COLLECTION_SLUG);
	upload.set("entrySlug", article.id);
	upload.set("file", input.file, input.file.name);
	const uploaded = await cmsRequest<{ contentType: string; fullPath: string; path: string; provider: string }>(
		input.session,
		"external-projects/assets/upload-url",
		{ body: upload, method: "POST" },
	);
	const asset = await cmsRequest<CmsAsset>(input.session, "external-projects/assets", {
		body: JSON.stringify({
			alt_text: input.altText?.trim() || null,
			asset_type: "image",
			entry_id: entryId,
			metadata: { contentType: uploaded.contentType, provider: uploaded.provider, source: "cybershield35" },
			storage_path: uploaded.path,
		}),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const [media] = await adminDb.insert(articleMedia).values({
		altText: input.altText?.trim() || null,
		articleId: article.id,
		caption: input.caption?.trim() || null,
		cmsAssetId: asset.id,
		cmsEntryId: entryId,
		contentType: input.file.type,
		createdByUserId: input.session.user.id,
		fileName: input.file.name,
		kind: input.kind,
		sizeBytes: input.file.size,
		storagePath: uploaded.path,
		storageProvider: uploaded.provider,
	}).returning();
	if (!media) throw new Error("Không thể lưu ảnh bài viết.");
	const previewUrl = `${input.requestOrigin}/api/articles/${article.id}/media/${media.id}`;
	if (input.kind === "cover") {
		await adminDb.update(articles).set({ coverStoragePath: uploaded.path, coverUrl: previewUrl, updatedAt: new Date() }).where(eq(articles.id, article.id));
	}
	return { media, previewUrl };
}

export async function publishArticleCmsMedia(articleId: string, session: TuturuuuAdminSession) {
	const [article] = await adminDb.select({ cmsEntryId: articles.cmsEntryId }).from(articles).where(eq(articles.id, articleId)).limit(1);
	if (!article?.cmsEntryId) return null;
	return cmsRequest<CmsEntry>(session, `external-projects/entries/${encodeURIComponent(article.cmsEntryId)}/publish`, {
		body: JSON.stringify({ eventKind: "publish" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
}

export async function getArticleMedia(articleId: string, mediaId: string) {
	const [media] = await adminDb.select().from(articleMedia).where(eq(articleMedia.id, mediaId)).limit(1);
	return media?.articleId === articleId ? media : null;
}

export async function resolveCmsAsset(assetId: string, session?: TuturuuuAdminSession) {
	return fetch(cmsUrl(`external-projects/assets/${encodeURIComponent(assetId)}`), {
		headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
		redirect: "manual",
	});
}

async function createArticleMediaEntry(session: TuturuuuAdminSession, article: typeof articles.$inferSelect) {
	const collections = await cmsRequest<CmsCollection[]>(session, "external-projects/collections", { method: "GET" });
	// Created on demand rather than required up front. `article-media` is the
	// collection this app declares for itself, so a workspace that has never
	// stored an image simply has not got one yet — which is a first-run state,
	// not a misconfiguration for someone to go and fix by hand.
	const collection =
		collections.find((item) => item.slug === COLLECTION_SLUG) ??
		(await cmsRequest<CmsCollection>(session, "external-projects/collections", {
			body: JSON.stringify({
				collection_type: COLLECTION_SLUG,
				config: {},
				description: "Ảnh bìa và ảnh nội dung của bài viết CyberShield35.",
				slug: COLLECTION_SLUG,
				title: "Ảnh bài viết",
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		}));
	const entry = await cmsRequest<CmsEntry>(session, "external-projects/entries", {
		body: JSON.stringify({ collection_id: collection.id, metadata: { cs35ArticleId: article.id }, profile_data: {}, slug: article.id, status: "draft", title: article.title || "Bài viết chưa đặt tên" }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	await adminDb.update(articles).set({ cmsEntryId: entry.id }).where(eq(articles.id, article.id));
	return entry.id;
}

async function cmsRequest<T>(session: TuturuuuAdminSession, suffix: string, init: RequestInit) {
	const response = await fetch(cmsUrl(suffix), {
		...init,
		cache: "no-store",
		headers: { Authorization: `Bearer ${session.accessToken}`, ...init.headers },
	});
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		// Logged because the caller's message is a safe generic one: a CMS refusal
		// reached nobody, so "Không thể tải ảnh lên" was the whole story an
		// operator — or anyone debugging — ever got.
		logOperation(
			"cms_request_failed",
			{
				body: JSON.stringify(body).slice(0, 500),
				// A 403 is either a scope the session was never granted or a
				// permission the workspace has not given the app. Naming the
				// granted scopes says which without another round trip.
				grantedScopes: getSessionGrantedScopes(session).join(" "),
				// The grant and the token can disagree, and the service reads the
				// token — so a 403 against a grant that looks complete is only
				// explicable by showing what the token itself carries.
				tokenScopes: describeAccessTokenClaims(session.accessToken).scopes.join(
					" ",
				),
				tokenTargetApp: describeAccessTokenClaims(session.accessToken).targetApp,
				tokenTyp: describeAccessTokenClaims(session.accessToken).typ,
				status: response.status,
				suffix,
			},
			"error",
		);
		throw new Error(
			body && typeof body === "object" && "error" in body
				? String(body.error)
				: `Tuturuuu CMS request failed (${response.status})`,
		);
	}
	return body as T;
}

function cmsUrl(suffix: string) {
	const workspaceId = process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID?.trim();
	if (!workspaceId) throw new Error("Tuturuuu CMS workspace chưa được cấu hình.");
	return buildTuturuuuApiUrl(`workspaces/${encodeURIComponent(workspaceId)}/${suffix}`);
}

/**
 * Copies any article image we do not host into Tuturuuu CMS storage.
 *
 * Automated drafts inherit the source post's image, which lives on the
 * platform's own CDN behind a signed, expiring, hotlink-protected URL. Zalo
 * fetches image URLs itself, so it answered `photo_url ... is invalid` and
 * refused the whole article — and even when it did work, the article pointed at
 * a link that would rot on somebody else's schedule.
 *
 * Re-hosting makes the image ours: fetched once, stored where we control it,
 * and served from our own origin for good.
 *
 * Failures are per-image and non-fatal. A cover that cannot be fetched is left
 * alone for the publication guard to report; taking the whole sync down here
 * would replace a clear message with an obscure one.
 */
export type CoverOutcome =
	/** Already served from our own origin. */
	| "already-hosted"
	/** Copied into CMS storage on this run. */
	| "rehosted"
	/** The source answered, so a real run would copy it. */
	| "reachable"
	/** The source is gone — only a person can supply a new image. */
	| "unreachable"
	/** The source answered but CMS refused the copy. */
	| "upload-failed"
	| "missing"
	| "none";

export async function rehostForeignArticleImages(input: {
	articleId: string;
	/** Reports what a real run would do without writing anything. */
	dryRun?: boolean;
	requestOrigin: string;
	session: TuturuuuAdminSession;
}) {
	const [article] = await adminDb
		.select()
		.from(articles)
		.where(eq(articles.id, input.articleId))
		.limit(1);
	if (!article) return { cover: "missing" as CoverOutcome, failed: 0, rehosted: 0 };

	const isForeign = (url: string | null): url is string =>
		Boolean(url?.startsWith("http")) &&
		!url!.startsWith(`${input.requestOrigin}/`);

	let failed = 0;
	let rehosted = 0;
	// Reported separately from the count, because "the source is gone" and "the
	// upload failed" need different answers: one needs a new image from a person,
	// the other will work on the next attempt.
	let cover: CoverOutcome = article.coverUrl ? "already-hosted" : "none";
	const blocks = [...article.blocks];

	if (isForeign(article.coverUrl)) {
		const file = await downloadRemoteImage(article.coverUrl);
		if (!file) {
			cover = "unreachable";
			failed += 1;
		} else if (input.dryRun) {
			cover = "reachable";
		} else {
			try {
				// Also rewrites articles.coverUrl, so nothing else needs updating.
				await uploadArticleCmsMedia({ ...input, file, kind: "cover" });
				cover = "rehosted";
				rehosted += 1;
			} catch {
				cover = "upload-failed";
				failed += 1;
			}
		}
	}

	for (const [index, block] of blocks.entries()) {
		if (block.type !== "image" || !isForeign(block.url)) continue;
		if (input.dryRun) continue;
		const file = await downloadRemoteImage(block.url);
		if (!file) {
			failed += 1;
			continue;
		}
		try {
			const { previewUrl } = await uploadArticleCmsMedia({
				...input,
				altText: block.caption ?? "",
				file,
				kind: "inline",
			});
			blocks[index] = { ...block, url: previewUrl };
			rehosted += 1;
		} catch {
			failed += 1;
		}
	}

	if (blocks.some((block, index) => block !== article.blocks[index])) {
		await adminDb
			.update(articles)
			.set({ blocks, updatedAt: new Date() })
			.where(eq(articles.id, article.id));
	}

	return { cover, failed, rehosted };
}

async function downloadRemoteImage(url: string) {
	const response = await fetch(url, {
		cache: "no-store",
		// CDNs reject requests without one, which is most of what needs copying.
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
		},
		signal: AbortSignal.timeout(15_000),
	}).catch(() => null);
	if (!response?.ok) return null;

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.startsWith("image/")) return null;
	const bytes = await response.arrayBuffer().catch(() => null);
	// Matches the upload's own ceiling, so an oversized image fails here with a
	// reason rather than inside the CMS call.
	if (!bytes || bytes.byteLength <= 0 || bytes.byteLength > 10 * 1024 * 1024) {
		return null;
	}

	const extension = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
	return new File([bytes], `cover.${extension}`, { type: contentType });
}
