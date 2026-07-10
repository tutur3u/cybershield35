import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";

import { z } from "zod";

const SESSION_COOKIE_NAME = "cybershield35_admin_session";
const PENDING_INVITATION_COOKIE_NAME =
	"cybershield35_pending_invitation";
const PENDING_INVITATION_MAX_AGE_SECONDS = 15 * 60;
const REQUESTED_SCOPES = [
	"workspace:session",
	"workspace:members:read",
	"workspace:members:write",
	"workspace:roles:read",
	"workspace:roles:write",
	"workspace:cron:read",
	"workspace:cron:write",
	"users:profile:read",
	"users:profile:write",
] as const;
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
	scopes: z.array(z.string().min(1)).optional(),
	tokenType: z.string().optional(),
	user: z.object({
		avatar_url: z.string().nullable().optional(),
		avatarUrl: z.string().nullable().optional(),
		display_name: z.string().nullable().optional(),
		displayName: z.string().nullable().optional(),
		email: z.string().nullable().optional(),
		full_name: z.string().nullable().optional(),
		fullName: z.string().nullable().optional(),
		id: z.string(),
		name: z.string().nullable().optional(),
	}),
	workspaceId: z.string().nullable().optional(),
});

const invitationSummarySchema = z.object({
	createdAt: z.string().nullable().optional(),
	role: z.string().nullable().optional(),
	source: z.string().nullable().optional(),
	workspaceHandle: z.string().nullable().optional(),
	workspaceId: z.string().min(1),
	workspaceName: z.string().nullable().optional(),
});

const pendingInvitationSchema = z.object({
	csrfToken: z.string().min(16),
	expiresAt: z.string().min(1),
	invitation: invitationSummarySchema,
	invitationActionToken: z.string().min(1),
	nextPath: z.string().min(1),
	workspaceId: z.string().min(1),
});

const invitationDecisionResponseSchema = z.union([
	exchangeResponseSchema,
	z.object({ status: z.literal("rejected") }),
]);

export type TuturuuuAdminSession = z.infer<typeof exchangeResponseSchema> & {
	createdAt: string;
	identityRefreshedAt?: string;
};

export type PlatformBearerResult = {
	authorization: string;
	session: TuturuuuAdminSession;
	setCookie: string | null;
};

export type SafeAdminSession = {
	appName: string | null;
	authenticated: boolean;
	expiresAt: string;
	refreshExpiresAt: string;
	user: {
		avatarUrl: string | null;
		displayName: string | null;
		email: string | null;
		id: string;
	};
};

export type EnvironmentDiagnosticStatus =
	| "configured"
	| "invalid"
	| "missing"
	| "optional";

export type EnvironmentDiagnostic = {
	message: string;
	name: string;
	required: boolean;
	status: EnvironmentDiagnosticStatus;
};

export type TuturuuuAuthDiagnostics = {
	configured: boolean;
	optional: EnvironmentDiagnostic[];
	required: EnvironmentDiagnostic[];
};

export type AuthErrorDetails = {
	code?: string;
	invitation?: PendingInvitationSummary;
	invitationActionToken?: string;
	workspaceId?: string;
};

export type PendingInvitationSummary = z.infer<typeof invitationSummarySchema>;

export type PendingInvitation = z.infer<typeof pendingInvitationSchema>;

export type PendingInvitationPublicView = {
	csrfToken: string;
	expiresAt: string;
	invitation: PendingInvitationSummary;
	nextPath: string;
};

export function isTuturuuuAuthConfigured() {
	return getTuturuuuAuthDiagnostics().configured;
}

export function getTuturuuuAuthDiagnostics(): TuturuuuAuthDiagnostics {
	const required = [
		diagnoseApiBaseUrl(),
		diagnoseRequiredEnv(
			"TUTURUUU_CYBERSHIELD35_WORKSPACE_ID",
			"Workspace id for the linked CyberShield external app.",
		),
		diagnoseRequiredEnv(
			"CYBERSHIELD35_APP_ID",
			"External app id from Tuturuuu.",
		),
		diagnoseRequiredEnv(
			"CYBERSHIELD35_APP_SECRET",
			"External app secret from Tuturuuu. Also encrypts sessions when CYBERSHIELD35_SESSION_SECRET is unset.",
		),
	];
	const optional = [
		diagnoseOptionalEnv(
			"CYBERSHIELD35_SESSION_SECRET",
			"Dedicated cookie encryption key. If unset, CYBERSHIELD35_APP_SECRET is used like Yashie.",
		),
	];

	return {
		configured: required.every((item) => item.status === "configured"),
		optional,
		required,
	};
}

export function allowLocalAuthBypass(request: Request) {
	if (process.env.AUTH_LOCAL_BYPASS !== "true") return false;
	if (process.env.NODE_ENV === "production") return false;

	const host = request.headers.get("host") ?? new URL(request.url).host;
	const hostname = hostnameFromHost(host);
	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname === "0.0.0.0" ||
		hostname === "::1"
	);
}

function hostnameFromHost(host: string) {
	if (host.startsWith("[")) {
		return host.slice(1, host.indexOf("]")).toLowerCase();
	}

	return (host.split(":")[0] ?? "").toLowerCase();
}

export function getRequestedScopes() {
	return [...REQUESTED_SCOPES];
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
		throw new AuthError(message, response.status, authErrorDetails(body));
	}

	const parsed = exchangeResponseSchema.parse(body);
	const now = new Date().toISOString();
	const scopes = normalizeScopes(
		parsed.scopes ?? decodeAccessTokenScopes(parsed.accessToken),
	);
	return {
		...parsed,
		createdAt: now,
		identityRefreshedAt: now,
		scopes,
	} satisfies TuturuuuAdminSession;
}

export async function decideTuturuuuPendingInvitation(
	pendingInvitation: PendingInvitation,
	action: "accept" | "reject",
) {
	const config = getAuthConfig();
	const response = await fetch(buildInvitationDecisionUrl(config.apiBaseUrl), {
		body: JSON.stringify({
			action,
			appId: config.appId,
			appSecret: config.appSecret,
			invitationActionToken: pendingInvitation.invitationActionToken,
			requestedScopes: getRequestedScopes(),
			workspaceId: pendingInvitation.workspaceId,
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
				: "Tuturuuu invitation decision failed";
		throw new AuthError(message, response.status, authErrorDetails(body));
	}

	const parsed = invitationDecisionResponseSchema.parse(body);
	if ("status" in parsed) return parsed;

	const now = new Date().toISOString();
	const scopes = normalizeScopes(
		parsed.scopes ?? decodeAccessTokenScopes(parsed.accessToken),
	);
	return {
		...parsed,
		createdAt: now,
		identityRefreshedAt: now,
		scopes,
	} satisfies TuturuuuAdminSession;
}

export function buildTuturuuuApiUrl(path: string) {
	const { apiBaseUrl } = getAuthConfig();
	const base = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
	return new URL(path.replace(/^\/+/u, ""), base).toString();
}

export function toSafeSession(session: TuturuuuAdminSession): SafeAdminSession {
	return {
		appName: session.app?.name ?? null,
		authenticated: true,
		expiresAt: session.expiresAt,
		refreshExpiresAt: session.refreshExpiresAt,
		user: {
			avatarUrl: firstCleanString(
				session.user.avatarUrl,
				session.user.avatar_url,
			),
			displayName: firstCleanString(
				session.user.displayName,
				session.user.display_name,
				session.user.name,
				session.user.fullName,
				session.user.full_name,
			),
			email: session.user.email ?? null,
			id: session.user.id,
		},
	};
}

function firstCleanString(...values: Array<string | null | undefined>) {
	for (const value of values) {
		const cleaned = value?.trim();
		if (cleaned) return cleaned;
	}
	return null;
}

export function sessionNeedsRefresh(session: TuturuuuAdminSession) {
	const refreshEarlySeconds =
		session.refreshEarlySeconds ?? REFRESH_SKEW_SECONDS;
	return (
		Date.parse(session.expiresAt) <= Date.now() + refreshEarlySeconds * 1000
	);
}

export function sessionNeedsIdentityRefresh(session: TuturuuuAdminSession) {
	if (session.identityRefreshedAt) return false;
	if (!sessionCanRefresh(session)) return false;

	const safeSession = toSafeSession(session);
	return !safeSession.user.displayName || !safeSession.user.avatarUrl;
}

export function sessionNeedsScopeRefresh(session: TuturuuuAdminSession) {
	if (!sessionCanRefresh(session)) return false;

	const grantedScopes = new Set(getSessionGrantedScopes(session));
	return getRequestedScopes().some((scope) => !grantedScopes.has(scope));
}

export function getSessionGrantedScopes(session: TuturuuuAdminSession) {
	const storedScopes = normalizeScopes(session.scopes);
	if (storedScopes.length > 0) return storedScopes;
	return normalizeScopes(decodeAccessTokenScopes(session.accessToken));
}

export function sessionCanRefresh(session: TuturuuuAdminSession) {
	return Date.parse(session.refreshExpiresAt) > Date.now();
}

export async function readAdminSession(request: Request) {
	const cookieValue = getCookie(request, SESSION_COOKIE_NAME);
	if (!cookieValue) return null;
	return decryptSession(cookieValue);
}

export function pendingInvitationPublicView(
	pendingInvitation: PendingInvitation | null,
): PendingInvitationPublicView | null {
	if (!pendingInvitation || pendingInvitationIsExpired(pendingInvitation)) {
		return null;
	}

	return {
		csrfToken: pendingInvitation.csrfToken,
		expiresAt: pendingInvitation.expiresAt,
		invitation: pendingInvitation.invitation,
		nextPath: pendingInvitation.nextPath,
	};
}

export async function readPendingInvitation(request: Request) {
	const cookieValue = getCookie(request, PENDING_INVITATION_COOKIE_NAME);
	if (!cookieValue) return null;
	const pendingInvitation = decryptPendingInvitation(cookieValue);
	if (!pendingInvitation || pendingInvitationIsExpired(pendingInvitation)) {
		return null;
	}

	return pendingInvitation;
}

export function pendingInvitationIsExpired(
	pendingInvitation: Pick<PendingInvitation, "expiresAt">,
) {
	return Date.parse(pendingInvitation.expiresAt) <= Date.now();
}

export function createPendingInvitationCookie(input: {
	invitation: PendingInvitationSummary;
	invitationActionToken: string;
	nextPath: string;
	workspaceId: string;
}) {
	const csrfToken = randomBytes(24).toString("base64url");
	const expiresAt = new Date(
		Date.now() + PENDING_INVITATION_MAX_AGE_SECONDS * 1000,
	).toISOString();
	const pendingInvitation: PendingInvitation = {
		csrfToken,
		expiresAt,
		invitation: input.invitation,
		invitationActionToken: input.invitationActionToken,
		nextPath: input.nextPath,
		workspaceId: input.workspaceId,
	};

	return {
		cookie: serializeCookie(
			PENDING_INVITATION_COOKIE_NAME,
			encryptPendingInvitation(pendingInvitation),
			{
				httpOnly: true,
				maxAge: PENDING_INVITATION_MAX_AGE_SECONDS,
				path: "/",
				sameSite: "Lax",
				secure: process.env.NODE_ENV === "production",
			},
		),
		pendingInvitation,
	};
}

export function clearPendingInvitationCookie() {
	return serializeCookie(PENDING_INVITATION_COOKIE_NAME, "", {
		httpOnly: true,
		maxAge: 0,
		path: "/",
		sameSite: "Lax",
		secure: process.env.NODE_ENV === "production",
	});
}

export async function refreshAdminSession(session: TuturuuuAdminSession) {
	if (Date.parse(session.refreshExpiresAt) <= Date.now()) {
		throw new AuthError("Tuturuuu admin session expired", 401);
	}

	const refreshKey = createHash("sha256")
		.update(session.refreshToken)
		.digest("base64url");
	const inFlight = inFlightSessionRefreshes.get(refreshKey);
	if (inFlight) return inFlight;

	const refresh = exchangeTuturuuuAppToken({
		refreshToken: session.refreshToken,
	});
	inFlightSessionRefreshes.set(refreshKey, refresh);

	try {
		return await refresh;
	} finally {
		if (inFlightSessionRefreshes.get(refreshKey) === refresh) {
			inFlightSessionRefreshes.delete(refreshKey);
		}
	}
}

const inFlightSessionRefreshes = new Map<
	string,
	Promise<TuturuuuAdminSession>
>();

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

export async function getBearerForPlatformRequest(
	request: Request,
): Promise<PlatformBearerResult> {
	let session = await readAdminSession(request);
	if (!session) throw new AuthError("Authentication required", 401);

	let setCookie: string | null = null;
	if (
		sessionNeedsRefresh(session) ||
		sessionNeedsIdentityRefresh(session) ||
		sessionNeedsScopeRefresh(session)
	) {
		session = await refreshAdminSession(session);
		setCookie = createSessionCookie(session);
	}

	return {
		authorization: `Bearer ${session.accessToken}`,
		session,
		setCookie,
	};
}

export async function fetchTuturuuuWithBearer(
	auth: PlatformBearerResult,
	input: string | URL,
	init: RequestInit = {},
) {
	let currentAuth = auth;
	let response = await fetchWithAuthorization(currentAuth, input, init);

	// A fresh request can still race platform-side token revocation. Refresh and
	// retry exactly once, but never rotate a token twice in the same operation.
	if (response.status === 401 && !currentAuth.setCookie) {
		await response.body?.cancel().catch(() => undefined);
		const session = await refreshAdminSession(currentAuth.session);
		currentAuth = {
			authorization: `Bearer ${session.accessToken}`,
			session,
			setCookie: createSessionCookie(session),
		};
		response = await fetchWithAuthorization(currentAuth, input, init);
	}

	return { auth: currentAuth, response };
}

export function updateAdminSessionIdentity(
	session: TuturuuuAdminSession,
	identity: {
		avatarUrl?: string | null;
		displayName?: string | null;
	},
) {
	const current = toSafeSession(session).user;
	const avatarUrl =
		identity.avatarUrl === undefined ? current.avatarUrl : identity.avatarUrl;
	const displayName =
		identity.displayName === undefined
			? current.displayName
			: identity.displayName;

	return {
		...session,
		identityRefreshedAt: new Date().toISOString(),
		user: {
			...session.user,
			avatar_url: avatarUrl,
			avatarUrl,
			display_name: displayName,
			displayName,
		},
	} satisfies TuturuuuAdminSession;
}

function fetchWithAuthorization(
	auth: PlatformBearerResult,
	input: string | URL,
	init: RequestInit,
) {
	const headers = new Headers(init.headers);
	headers.set("Authorization", auth.authorization);

	return fetch(input, {
		...init,
		cache: "no-store",
		headers,
	});
}

export function sanitizeAuthError(error: unknown) {
	if (error instanceof AuthError) {
		return {
			code: error.details.code,
			invitation: error.details.invitation,
			message: error.message,
			status: error.status,
			workspaceId: error.details.workspaceId,
		};
	}

	return {
		code: undefined,
		invitation: undefined,
		message: error instanceof Error ? error.message : "Authentication failed",
		status: 500,
		workspaceId: undefined,
	};
}

export class AuthError extends Error {
	constructor(
		message: string,
		readonly status = 401,
		readonly details: AuthErrorDetails = {},
	) {
		super(message);
		this.name = "AuthError";
	}
}

function authErrorDetails(body: unknown): AuthErrorDetails {
	if (!body || typeof body !== "object") return {};
	const row = body as Record<string, unknown>;
	const errorMessage = typeof row.error === "string" ? row.error : undefined;
	const code =
		cleanEnv(typeof row.code === "string" ? row.code : undefined) ??
		inferAuthErrorCode(errorMessage);
	const invitationActionToken = cleanEnv(
		typeof row.invitationActionToken === "string"
			? row.invitationActionToken
			: undefined,
	);
	const invitation = invitationSummarySchema
		.safeParse(row.invitation)
		.success
		? invitationSummarySchema.parse(row.invitation)
		: undefined;
	const workspaceId = cleanEnv(
		typeof row.workspaceId === "string" ? row.workspaceId : undefined,
	);
	return {
		...(code ? { code } : {}),
		...(invitation ? { invitation } : {}),
		...(invitationActionToken ? { invitationActionToken } : {}),
		...(workspaceId ? { workspaceId } : {}),
	};
}

function inferAuthErrorCode(errorMessage: string | undefined) {
	if (!errorMessage) return undefined;
	const normalized = errorMessage.toLowerCase();
	if (
		normalized.includes("invitation action token") &&
		normalized.includes("expired") &&
		normalized.includes("already used")
	) {
		return "INVITATION_ACTION_TOKEN_ALREADY_USED";
	}
	return undefined;
}

function getAuthConfig() {
	const apiBaseUrl = process.env.TUTURUUU_API_BASE_URL;
	const workspaceId = process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID;
	const appId = process.env.CYBERSHIELD35_APP_ID;
	const appSecret = process.env.CYBERSHIELD35_APP_SECRET;

	const diagnostics = getTuturuuuAuthDiagnostics();
	if (
		!diagnostics.configured ||
		!apiBaseUrl ||
		!workspaceId ||
		!appId ||
		!appSecret
	) {
		throw new AuthError(formatAuthConfigError(diagnostics), 503);
	}

	return { apiBaseUrl, appId, appSecret, workspaceId };
}

function diagnoseApiBaseUrl(): EnvironmentDiagnostic {
	const value = cleanEnv(process.env.TUTURUUU_API_BASE_URL);
	if (!value) {
		return {
			message:
				"Set the Tuturuuu API base URL, for example https://tuturuuu.com/api/v1.",
			name: "TUTURUUU_API_BASE_URL",
			required: true,
			status: "missing",
		};
	}

	try {
		const url = new URL(value);
		if (url.pathname.replace(/\/+$/u, "") !== "/api/v1") {
			return {
				message:
					"Must end with /api/v1 so token exchange routes resolve correctly.",
				name: "TUTURUUU_API_BASE_URL",
				required: true,
				status: "invalid",
			};
		}
	} catch {
		return {
			message: "Must be a valid absolute URL ending in /api/v1.",
			name: "TUTURUUU_API_BASE_URL",
			required: true,
			status: "invalid",
		};
	}

	return {
		message: "Configured.",
		name: "TUTURUUU_API_BASE_URL",
		required: true,
		status: "configured",
	};
}

function diagnoseRequiredEnv(
	name: string,
	configuredMessage: string,
): EnvironmentDiagnostic {
	if (!cleanEnv(process.env[name])) {
		return {
			message: "Missing. Set this server-side in Vercel and redeploy.",
			name,
			required: true,
			status: "missing",
		};
	}

	return {
		message: configuredMessage,
		name,
		required: true,
		status: "configured",
	};
}

function diagnoseOptionalEnv(
	name: string,
	configuredMessage: string,
): EnvironmentDiagnostic {
	if (!cleanEnv(process.env[name])) {
		return {
			message: "Optional. Not set; the app will use CYBERSHIELD35_APP_SECRET.",
			name,
			required: false,
			status: "optional",
		};
	}

	return {
		message: configuredMessage,
		name,
		required: false,
		status: "configured",
	};
}

function formatAuthConfigError(diagnostics: TuturuuuAuthDiagnostics) {
	const failing = diagnostics.required.filter(
		(item) => item.status !== "configured",
	);
	if (!failing.length) return "Tuturuuu external app auth is not configured";
	return `Tuturuuu auth config issue: ${failing
		.map((item) => `${item.name} is ${item.status}`)
		.join(", ")}`;
}

function cleanEnv(value: string | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
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
	return encryptJson(session);
}

function encryptPendingInvitation(pendingInvitation: PendingInvitation) {
	return encryptJson(pendingInvitation);
}

function encryptJson(value: unknown) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", getSessionKey(), iv);
	const encrypted = Buffer.concat([
		cipher.update(JSON.stringify(value), "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return [iv, tag, encrypted]
		.map((part) => part.toString("base64url"))
		.join(".");
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
			.extend({
				createdAt: z.string(),
				identityRefreshedAt: z.string().optional(),
				scopes: z.array(z.string().min(1)).optional(),
			})
			.parse(JSON.parse(decrypted));
	} catch {
		return null;
	}
}

function decryptPendingInvitation(value: string): PendingInvitation | null {
	try {
		const parsed = decryptJson(value);
		return pendingInvitationSchema.parse(parsed);
	} catch {
		return null;
	}
}

function decryptJson(value: string) {
	const [ivPart, tagPart, encryptedPart] = value.split(".");
	if (!ivPart || !tagPart || !encryptedPart) return null;

	const decipher = createDecipheriv(
		"aes-256-gcm",
		getSessionKey(),
		Buffer.from(ivPart, "base64url"),
	);
	decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
	return JSON.parse(
		Buffer.concat([
			decipher.update(Buffer.from(encryptedPart, "base64url")),
			decipher.final(),
		]).toString("utf8"),
	);
}

function getSessionKey() {
	const secret =
		process.env.CYBERSHIELD35_SESSION_SECRET ??
		process.env.CYBERSHIELD35_APP_SECRET;
	if (!secret?.trim()) {
		throw new AuthError(
			"CYBERSHIELD35_SESSION_SECRET or CYBERSHIELD35_APP_SECRET is required",
			503,
		);
	}
	return createHash("sha256").update(secret.trim()).digest();
}

function buildExchangeUrl(apiBaseUrl: string) {
	const base = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
	return new URL("auth/app-token/exchange", base).toString();
}

function buildInvitationDecisionUrl(apiBaseUrl: string) {
	const base = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
	return new URL("auth/app-token/invitation-decision", base).toString();
}

function normalizeScopes(scopes: unknown) {
	if (!Array.isArray(scopes)) return [];
	return [
		...new Set(
			scopes
				.map((scope) => (typeof scope === "string" ? scope.trim() : ""))
				.filter(Boolean),
		),
	];
}

function decodeAccessTokenScopes(accessToken: string) {
	const [, payload] = accessToken.split(".");
	if (!payload) return [];

	try {
		const parsed = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf8"),
		) as { scopes?: unknown };
		return normalizeScopes(parsed.scopes);
	} catch {
		return [];
	}
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
