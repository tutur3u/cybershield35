import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import {
	decryptCookieJson,
	encryptCookieJson,
	readRequestCookie,
	serializeCookie,
} from "@/lib/auth/cookie-crypto";

export const LOCAL_SESSION_COOKIE_NAME = "cybershield35_local_session";
export const LOCAL_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

const localSessionCookieSchema = z.object({
	accountId: z.uuid(),
	displayName: z.string().nullable(),
	expiresAt: z.string().min(1),
	issuedAt: z.string().min(1),
	mustChangePassword: z.boolean(),
	role: z.enum(["admin", "member"]),
	sessionId: z.uuid(),
	token: z.string().min(16),
	username: z.string().min(1),
});

export type LocalSessionCookie = z.infer<typeof localSessionCookieSchema>;

export function createLocalSessionToken() {
	return randomBytes(32).toString("base64url");
}

export function hashLocalSessionToken(token: string) {
	return createHash("sha256").update(token).digest("base64url");
}

/**
 * The cookie is self-describing so the proxy can gate routes without a database
 * round trip. Revocation still runs server-side against `local_account_sessions`
 * before any request is actually authorized.
 */
export function readLocalSessionCookie(
	request: Request,
): LocalSessionCookie | null {
	const cookieValue = readRequestCookie(request, LOCAL_SESSION_COOKIE_NAME);
	if (!cookieValue) return null;

	try {
		const parsed = localSessionCookieSchema.parse(decryptCookieJson(cookieValue));
		return localSessionIsExpired(parsed) ? null : parsed;
	} catch {
		return null;
	}
}

export function localSessionIsExpired(session: Pick<LocalSessionCookie, "expiresAt">) {
	return Date.parse(session.expiresAt) <= Date.now();
}

export function createLocalSessionCookie(session: LocalSessionCookie) {
	const maxAge = Math.max(
		0,
		Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000),
	);

	return serializeCookie(
		LOCAL_SESSION_COOKIE_NAME,
		encryptCookieJson(session),
		{
			httpOnly: true,
			maxAge,
			path: "/",
			sameSite: "Lax",
			secure: process.env.NODE_ENV === "production",
		},
	);
}

export function clearLocalSessionCookie() {
	return serializeCookie(LOCAL_SESSION_COOKIE_NAME, "", {
		httpOnly: true,
		maxAge: 0,
		path: "/",
		sameSite: "Lax",
		secure: process.env.NODE_ENV === "production",
	});
}
