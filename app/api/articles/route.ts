import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { createArticle, getCachedArticlesPage } from "@/lib/articles/store";
import { articleCreateSchema } from "@/lib/articles/schemas";
import { actorFromAuth } from "@/lib/chat/http";
import { publicErrorMessage } from "@/lib/http/public-error";
import { getCachedZaloArticleCatalogPage } from "@/lib/zalo/articles";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 10;

type CatalogCursor = {
	localCursor: string | null;
	localDone: boolean;
	remoteOffset: number;
	remoteDone: boolean;
};

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	try {
		const url = new URL(request.url);
		const limit = normalizePageSize(url.searchParams.get("limit"));
		const scope = url.searchParams.get("scope");
		if (scope === "local") {
			const local = await getCachedArticlesPage({
				cursor: url.searchParams.get("cursor"),
				limit,
			});
			return Response.json(
				{
					articles: local.items,
					hasNextPage: local.hasNextPage,
					nextCursor: local.nextCursor,
					zaloArticles: [],
					zaloIssues: [],
				},
				{ headers: authHeaders(auth) },
			);
		}
		if (scope === "zalo") {
			const offset = normalizeOffset(url.searchParams.get("cursor"));
			const zalo = await getCachedZaloArticleCatalogPage({ limit, offset });
			return Response.json(
				{
					articles: [],
					hasNextPage: zalo.hasNextPage,
					nextCursor: zalo.hasNextPage ? String(offset + limit) : null,
					zaloArticles: zalo.articles,
					zaloIssues: zalo.issues,
				},
				{ headers: authHeaders(auth) },
			);
		}
		const cursor = parseCatalogCursor(url.searchParams.get("cursor"));
		const [local, zalo] = await Promise.all([
			cursor.localDone
				? Promise.resolve({
						hasNextPage: false,
						items: [],
						nextCursor: null,
					})
				: getCachedArticlesPage({ cursor: cursor.localCursor, limit }),
			cursor.remoteDone
				? Promise.resolve({ articles: [], hasNextPage: false, issues: [] })
				: getCachedZaloArticleCatalogPage({
						limit,
						offset: cursor.remoteOffset,
					}),
		]);
		const nextState: CatalogCursor = {
			localCursor: local.nextCursor,
			localDone: cursor.localDone || !local.hasNextPage,
			remoteOffset: cursor.remoteOffset + limit,
			remoteDone: cursor.remoteDone || !zalo.hasNextPage,
		};
		const hasNextPage = !nextState.localDone || !nextState.remoteDone;
		return Response.json(
			{
				articles: local.items,
				hasNextPage,
				nextCursor: hasNextPage ? JSON.stringify(nextState) : null,
				zaloArticles: zalo.articles,
				zaloIssues: zalo.issues,
			},
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error: publicErrorMessage(error, "Không thể tải bài viết."),
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}

function normalizePageSize(value: string | null) {
	const parsed = Math.floor(Number(value ?? DEFAULT_PAGE_SIZE));
	if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE;
	return Math.min(MAX_PAGE_SIZE, parsed);
}

function normalizeOffset(value: string | null) {
	const parsed = Math.floor(Number(value ?? 0));
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseCatalogCursor(value: string | null): CatalogCursor {
	const fallback: CatalogCursor = {
		localCursor: null,
		localDone: false,
		remoteOffset: 0,
		remoteDone: false,
	};
	if (!value) return fallback;
	try {
		const parsed = JSON.parse(value) as Partial<CatalogCursor>;
		return {
			localCursor:
				typeof parsed.localCursor === "string"
					? parsed.localCursor
					: null,
			localDone: parsed.localDone === true,
			remoteOffset:
				typeof parsed.remoteOffset === "number" &&
				Number.isFinite(parsed.remoteOffset) &&
				parsed.remoteOffset >= 0
					? Math.floor(parsed.remoteOffset)
					: 0,
			remoteDone: parsed.remoteDone === true,
		};
	} catch {
		return fallback;
	}
}

export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	try {
		const input = articleCreateSchema.parse(await request.json());
		const article = await createArticle(input, actorFromAuth(auth));
		return Response.json(
			{ article },
			{ status: 201, headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return Response.json(
			{
				error: publicErrorMessage(error, "Không thể tạo bài viết."),
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
