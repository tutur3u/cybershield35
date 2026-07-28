import "server-only";

import { z } from "zod";

import type { ArticleBlock } from "@/lib/articles/schemas";

const ZALO_OPEN_API_BASE = "https://openapi.zalo.me";
const ZALO_OAUTH_BASE = "https://oauth.zaloapp.com/v4/oa";

const tokenResponseSchema = z
	.object({
		access_token: z.string().min(1),
		expires_in: z.coerce.number().positive().optional(),
		refresh_token: z.string().min(1),
	})
	.passthrough();

export type ZaloTokenResponse = {
	accessToken: string;
	accessTokenExpiresIn: number;
	refreshToken: string;
	refreshTokenExpiresIn: number;
};

export function isZaloEnabled() {
	return process.env.ZALO_OA_ENABLED === "true";
}

export function getZaloConfig(requestUrl?: string) {
	const appId = requiredEnv("ZALO_APP_ID");
	const appSecret = requiredEnv("ZALO_APP_SECRET");
	const configuredRedirect = process.env.ZALO_REDIRECT_URI?.trim();
	const publicAppUrl =
		process.env.CYBERSHIELD35_PUBLIC_APP_URL?.trim() ??
		(requestUrl ? new URL(requestUrl).origin : undefined);
	const redirectUri =
		configuredRedirect ??
		(publicAppUrl
			? new URL("/api/integrations/zalo/callback", publicAppUrl).toString()
			: undefined);
	if (!redirectUri) throw new Error("ZALO_REDIRECT_URI is not configured");
	return { appId, appSecret, redirectUri };
}

export function buildZaloAuthorizationUrl(input: {
	codeChallenge: string;
	redirectUri: string;
	state: string;
}) {
	const { appId } = getZaloConfig();
	const url = new URL(`${ZALO_OAUTH_BASE}/permission`);
	url.searchParams.set("app_id", appId);
	url.searchParams.set("redirect_uri", input.redirectUri);
	url.searchParams.set("code_challenge", input.codeChallenge);
	url.searchParams.set("state", input.state);
	return url.toString();
}

export async function exchangeZaloAuthorizationCode(input: {
	code: string;
	codeVerifier: string;
}) {
	const config = getZaloConfig();
	return exchangeToken({
		appSecret: config.appSecret,
		body: {
			app_id: config.appId,
			code: input.code,
			code_verifier: input.codeVerifier,
			grant_type: "authorization_code",
		},
	});
}

export async function refreshZaloToken(refreshToken: string) {
	const config = getZaloConfig();
	return exchangeToken({
		appSecret: config.appSecret,
		body: {
			app_id: config.appId,
			grant_type: "refresh_token",
			refresh_token: refreshToken,
		},
	});
}

export async function fetchZaloOaProfile(accessToken: string, oaId: string) {
	const body = await zaloRequest<Record<string, unknown>>(
		accessToken,
		"/v2.0/oa/getoa",
		{ method: "GET" },
	);
	const data = objectValue(body.data);
	return {
		avatarUrl:
			stringValue(data.avatar) ??
			stringValue(data.avatar_url) ??
			stringValue(data.cover),
		displayName:
			stringValue(data.name) ??
			stringValue(data.display_name) ??
			`Zalo OA ${oaId}`,
		oaId: stringValue(data.oaid) ?? stringValue(data.oa_id) ?? oaId,
	};
}

export async function createZaloArticle(
	accessToken: string,
	content: ZaloArticleContent,
) {
	return submitArticleOperation(
		accessToken,
		"/v2.0/article/create",
		toZaloArticlePayload(content),
	);
}

export async function updateZaloArticle(
	accessToken: string,
	remoteArticleId: string,
	content: ZaloArticleContent,
) {
	return submitArticleOperation(accessToken, "/v2.0/article/update", {
		id: remoteArticleId,
		...toZaloArticlePayload(content),
	});
}

export async function removeZaloArticle(
	accessToken: string,
	remoteArticleId: string,
) {
	return zaloRequest<Record<string, unknown>>(
		accessToken,
		"/v2.0/article/remove",
		{
			body: JSON.stringify({ id: remoteArticleId }),
			method: "POST",
		},
	);
}

export async function verifyZaloArticleOperation(
	accessToken: string,
	token: string,
) {
	const body = await zaloRequest<Record<string, unknown>>(
		accessToken,
		"/v2.0/article/verify",
		{ body: JSON.stringify({ token }), method: "POST" },
	);
	const data = objectValue(body.data);
	const id = stringValue(data.id) ?? stringValue(data.article_id);
	if (!id) {
		throw new ZaloApiError("Zalo chưa trả về ID bài viết.", 502, body);
	}
	return { id, raw: body };
}

export async function getZaloArticle(
	accessToken: string,
	remoteArticleId: string,
) {
	const path = `/v2.0/article/getdetail?id=${encodeURIComponent(remoteArticleId)}`;
	return zaloRequest<Record<string, unknown>>(accessToken, path, {
		method: "GET",
	});
}

export async function listZaloArticles(
	accessToken: string,
	input: { limit?: number; offset?: number } = {},
) {
	const params = new URLSearchParams({
		limit: String(Math.min(20, Math.max(1, input.limit ?? 10))),
		offset: String(Math.max(0, input.offset ?? 0)),
		type: "normal",
	});
	return zaloRequest<Record<string, unknown>>(
		accessToken,
		`/v2.0/article/getslice?${params.toString()}`,
		{ method: "GET" },
	);
}

export type ZaloArticleContent = {
	author: string;
	blocks: ArticleBlock[];
	commentsEnabled: boolean;
	coverUrl: string | null;
	description: string;
	status: "hide" | "show";
	title: string;
};

function toZaloArticlePayload(content: ZaloArticleContent) {
	if (!content.title.trim()) throw new Error("Tiêu đề bài viết là bắt buộc.");
	if (!content.description.trim()) {
		throw new Error("Mô tả bài viết là bắt buộc.");
	}
	if (!content.coverUrl) throw new Error("Ảnh bìa bài viết là bắt buộc.");
	if (!content.blocks.length) throw new Error("Bài viết cần ít nhất một khối nội dung.");
	return {
		author: content.author,
		body: content.blocks.map((block) =>
			block.type === "text"
				? { content: block.content, type: "text" }
				: {
						...(block.caption ? { caption: block.caption } : {}),
						url: block.url,
						type: "image",
					},
		),
		comment: content.commentsEnabled ? "show" : "hide",
		cover: {
			cover_type: "photo",
			photo_url: content.coverUrl,
			status: "show",
		},
		description: content.description,
		status: content.status,
		title: content.title,
		type: "normal",
	};
}

async function submitArticleOperation(
	accessToken: string,
	path: string,
	payload: Record<string, unknown>,
) {
	const body = await zaloRequest<Record<string, unknown>>(accessToken, path, {
		body: JSON.stringify(payload),
		method: "POST",
	});
	const data = objectValue(body.data);
	const token = stringValue(data.token);
	if (!token) {
		throw new ZaloApiError("Zalo không trả về mã xác minh thao tác.", 502, body);
	}
	return { raw: body, token };
}

async function exchangeToken(input: {
	appSecret: string;
	body: Record<string, string>;
}): Promise<ZaloTokenResponse> {
	const response = await fetch(`${ZALO_OAUTH_BASE}/access_token`, {
		body: new URLSearchParams(input.body),
		cache: "no-store",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			secret_key: input.appSecret,
		},
		method: "POST",
	});
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		throw new ZaloApiError(
			zaloErrorMessage(body, "Không thể đổi mã ủy quyền Zalo."),
			response.status,
			body,
		);
	}
	const parsed = tokenResponseSchema.parse(body);
	return {
		accessToken: parsed.access_token,
		accessTokenExpiresIn: parsed.expires_in ?? 25 * 60 * 60,
		refreshToken: parsed.refresh_token,
		refreshTokenExpiresIn: 90 * 24 * 60 * 60,
	};
}

async function zaloRequest<T>(
	accessToken: string,
	path: string,
	init: RequestInit,
) {
	const headers = new Headers(init.headers);
	headers.set("access_token", accessToken);
	if (init.body) headers.set("Content-Type", "application/json");
	const response = await fetch(`${ZALO_OPEN_API_BASE}${path}`, {
		...init,
		cache: "no-store",
		headers,
	});
	const body = await response.json().catch(() => null);
	if (!response.ok || hasZaloError(body)) {
		throw new ZaloApiError(
			zaloErrorMessage(body, "Zalo OA API từ chối yêu cầu."),
			response.ok ? 502 : response.status,
			body,
		);
	}
	return body as T;
}

function hasZaloError(body: unknown) {
	if (!body || typeof body !== "object") return false;
	const error = "error" in body ? body.error : undefined;
	return typeof error === "number" ? error !== 0 : false;
}

function zaloErrorMessage(body: unknown, fallback: string) {
	if (!body || typeof body !== "object") return fallback;
	const record = body as Record<string, unknown>;
	for (const key of ["message", "error_name", "error_description"]) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) return value.slice(0, 500);
	}
	return fallback;
}

function objectValue(value: unknown): Record<string, unknown> {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: {};
}

function stringValue(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredEnv(name: string) {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is not configured`);
	return value;
}

export class ZaloApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly details?: unknown,
	) {
		super(message);
		this.name = "ZaloApiError";
	}
}
