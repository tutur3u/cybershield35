import { createCipheriv, createDecipheriv, createHash } from "node:crypto";

export type CookieOptions = {
	httpOnly?: boolean;
	maxAge?: number;
	path?: string;
	sameSite?: "Lax" | "None" | "Strict";
	secure?: boolean;
};

/**
 * Every CyberShield35 cookie payload is sealed with the same AES-256-GCM key so
 * a single rotated secret invalidates local and Tuturuuu sessions together.
 */
export function encryptCookieJson(value: unknown) {
	const iv = randomIv();
	const cipher = createCipheriv("aes-256-gcm", getCookieKey(), iv);
	const encrypted = Buffer.concat([
		cipher.update(JSON.stringify(value), "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptCookieJson(value: string): unknown {
	const [ivPart, tagPart, encryptedPart] = value.split(".");
	if (!ivPart || !tagPart || !encryptedPart) return null;

	const decipher = createDecipheriv(
		"aes-256-gcm",
		getCookieKey(),
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

export function readRequestCookie(request: Request, name: string) {
	const cookieHeader = request.headers.get("cookie") ?? "";
	for (const cookie of cookieHeader.split(/;\s*/u)) {
		const [key, ...valueParts] = cookie.split("=");
		if (key === name) return decodeURIComponent(valueParts.join("="));
	}
	return null;
}

export function serializeCookie(
	name: string,
	value: string,
	options: CookieOptions,
) {
	const parts = [`${name}=${encodeURIComponent(value)}`];
	if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
	if (options.path) parts.push(`Path=${options.path}`);
	if (options.httpOnly) parts.push("HttpOnly");
	if (options.secure) parts.push("Secure");
	if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
	return parts.join("; ");
}

export class CookieKeyError extends Error {
	constructor() {
		super("CYBERSHIELD35_SESSION_SECRET or CYBERSHIELD35_APP_SECRET is required");
		this.name = "CookieKeyError";
	}
}

export function getCookieKey() {
	const secret =
		process.env.CYBERSHIELD35_SESSION_SECRET ??
		process.env.CYBERSHIELD35_APP_SECRET;
	if (!secret?.trim()) throw new CookieKeyError();
	return createHash("sha256").update(secret.trim()).digest();
}

function randomIv() {
	const iv = new Uint8Array(12);
	crypto.getRandomValues(iv);
	return Buffer.from(iv);
}
