import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { z } from "zod";

const SESSION_COOKIE_NAME = "cybershield35_admin_session";
const DEFAULT_SCOPES = ["external-projects:read"];
const REFRESH_SKEW_SECONDS = 90;

const exchangeResponseSchema = z.object({
	accessToken: z.string().min(1),
	app: z.object({ name: z.string().optional() }).optional(),
	expiresAt: z.string().min(1),
	expiresIn: z.number().optional(),
	refreshEarlySeconds: z.number().optional(),
	refreshExpiresAt: z.string().min(1),
	refreshExpiresIn: z.number().optional(),
	refreshToken: z.string().min(1),
	tokenType: z.string().optional(),
	user: z.object({
		email: z.string().nullable().optional(),
		id: z.string(),
	}),
	workspaceId: z.string().nullable().optional(),
});

export type TuturuuuAdminSession = z.infer<typeof exchangeResponseSchema> & {
	createdAt: string;
};

export type SafeAdminSession = {
	appName: string | null;
	authenticated: boolean;
	expiresAt: string;
	refreshExpiresAt: string;
	user: {
		email: string | null;
		id: string;
	};
	workspaceId: string | null;
};

export function isTuturuuuAuthConfigured() {
	return Boolean(
		process.env.TUTURUUU_API_BASE_URL &&
			process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID &&
			process.env.CYBERSHIELD35_APP_ID &&
			process.env.CYBERSHIELD35_APP_SECRET &&
			process.env.CYBERSHIELD35_SESSION_SECRET,
	);
}

export function getRequestedScopes() {
	return (
		process.env.CYBERSHIELD35_REQUESTED_SCOPES?.split(",")
			.map((scope) => scope.trim())
			.filter(Boolean) ?? DEFAULT_SCOPES
	);
}

export async function exchangeTuturuuuAppToken(input: {
	refreshToken?: string;
	token?: string;
}) {
	if (Boolean(input.token) === Boolean(input.refreshToken)) {
		throw new AuthError("Provide exactly one token or refresh token", 400);
	}

	const config = getAuthConfig();
	const response = await fetch(buildExchangeUrl(config.apiBaseUrl), {
		body: JSON.stringify({
			appId: config.appId,
			appSecret: config.appSecret,
			refreshToken: input.refreshToken,
			requestedScopes: getRequestedScopes(),
			token: input.token,
			workspaceId: config.workspaceId,
		}),
		cache: "no-store",
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});

	const body = await response.json().catch(() => null);
	if (!response.ok) {
		const message =
			body && typeof body === "object" && "error" in body
				? String(body.error)
				: "Tuturuuu token exchange failed";
		throw new AuthError(message, response.status);
	}

	const parsed = exchangeResponseSchema.parse(body);
	return { ...parsed, createdAt: new Date().toISOString() } satisfies TuturuuuAdminSession;
}

export function toSafeSession(session: TuturuuuAdminSession): SafeAdminSession {
	return {
		appName: session.app?.name ?? null,
		authenticated: true,
		expiresAt: session.expiresAt,
		refreshExpiresAt: session.refreshExpiresAt,
		user: {
			email: session.user.email ?? null,
			id: session.user.id,
		},
		workspaceId: session.workspaceId ?? null,
	};
}

export function sessionNeedsRefresh(session: TuturuuuAdminSession) {
	const refreshEarlySeconds = session.refreshEarlySeconds ?? REFRESH_SKEW_SECONDS;
	return Date.parse(session.expiresAt) <= Date.now() + refreshEarlySeconds * 1000;
}

export async function readAdminSession(request: Request) {
	const cookieValue = getCookie(request, SESSION_COOKIE_NAME);
	if (!cookieValue) return null;
	return decryptSession(cookieValue);
}

export async function refreshAdminSession(session: TuturuuuAdminSession) {
	if (Date.parse(session.refreshExpiresAt) <= Date.now()) {
		throw new AuthError("Tuturuuu admin session expired", 401);
	}

	return exchangeTuturuuuAppToken({ refreshToken: session.refreshToken });
}

export function createSessionCookie(session: TuturuuuAdminSession) {
	const maxAge = Math.max(
		0,
		Math.floor((Date.parse(session.refreshExpiresAt) - Date.now()) / 1000),
	);
	return serializeCookie(SESSION_COOKIE_NAME, encryptSession(session), {
		httpOnly: true,
		maxAge,
		path: "/",
		sameSite: "Lax",
		secure: process.env.NODE_ENV === "production",
	});
}

export function clearSessionCookie() {
	return serializeCookie(SESSION_COOKIE_NAME, "", {
		httpOnly: true,
		maxAge: 0,
		path: "/",
		sameSite: "Lax",
		secure: process.env.NODE_ENV === "production",
	});
}

export async function getBearerForPlatformRequest(request: Request) {
	let session = await readAdminSession(request);
	if (!session) throw new AuthError("Authentication required", 401);

	let setCookie: string | null = null;
	if (sessionNeedsRefresh(session)) {
		session = await refreshAdminSession(session);
		setCookie = createSessionCookie(session);
	}

	return {
		authorization: `Bearer ${session.accessToken}`,
		session,
		setCookie,
	};
}

export function sanitizeAuthError(error: unknown) {
	if (error instanceof AuthError) {
		return { message: error.message, status: error.status };
	}

	return {
		message: error instanceof Error ? error.message : "Authentication failed",
		status: 500,
	};
}

export class AuthError extends Error {
	constructor(
		message: string,
		readonly status = 401,
	) {
		super(message);
		this.name = "AuthError";
	}
}

function getAuthConfig() {
	const apiBaseUrl = process.env.TUTURUUU_API_BASE_URL;
	const workspaceId = process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID;
	const appId = process.env.CYBERSHIELD35_APP_ID;
	const appSecret = process.env.CYBERSHIELD35_APP_SECRET;

	if (!apiBaseUrl || !workspaceId || !appId || !appSecret) {
		throw new AuthError("Tuturuuu external app auth is not configured", 503);
	}

	return { apiBaseUrl, appId, appSecret, workspaceId };
}

function getCookie(request: Request, name: string) {
	const cookieHeader = request.headers.get("cookie") ?? "";
	const cookies = cookieHeader.split(/;\s*/u);
	for (const cookie of cookies) {
		const [key, ...valueParts] = cookie.split("=");
		if (key === name) return decodeURIComponent(valueParts.join("="));
	}
	return null;
}

function encryptSession(session: TuturuuuAdminSession) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", getSessionKey(), iv);
	const encrypted = Buffer.concat([
		cipher.update(JSON.stringify(session), "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptSession(value: string): TuturuuuAdminSession | null {
	try {
		const [ivPart, tagPart, encryptedPart] = value.split(".");
		if (!ivPart || !tagPart || !encryptedPart) return null;

		const decipher = createDecipheriv(
			"aes-256-gcm",
			getSessionKey(),
			Buffer.from(ivPart, "base64url"),
		);
		decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
		const decrypted = Buffer.concat([
			decipher.update(Buffer.from(encryptedPart, "base64url")),
			decipher.final(),
		]).toString("utf8");
		return exchangeResponseSchema
			.extend({ createdAt: z.string() })
			.parse(JSON.parse(decrypted));
	} catch {
		return null;
	}
}

function getSessionKey() {
	const secret = process.env.CYBERSHIELD35_SESSION_SECRET;
	if (!secret || secret.length < 32) {
		throw new AuthError("CYBERSHIELD35_SESSION_SECRET must be at least 32 characters", 503);
	}
	return createHash("sha256").update(secret).digest();
}

function buildExchangeUrl(apiBaseUrl: string) {
	const base = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
	return new URL("auth/app-token/exchange", base).toString();
}

function serializeCookie(
	name: string,
	value: string,
	options: {
		httpOnly?: boolean;
		maxAge?: number;
		path?: string;
		sameSite?: "Lax" | "Strict" | "None";
		secure?: boolean;
	},
) {
	const parts = [`${name}=${encodeURIComponent(value)}`];
	if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
	if (options.path) parts.push(`Path=${options.path}`);
	if (options.httpOnly) parts.push("HttpOnly");
	if (options.secure) parts.push("Secure");
	if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
	return parts.join("; ");
}
