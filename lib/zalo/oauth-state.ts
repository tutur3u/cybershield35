import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { decryptZaloSecret, encryptZaloSecret } from "./crypto";

export const ZALO_OAUTH_COOKIE = "cybershield35_zalo_oauth";

type ZaloOauthState = {
	actorUserId: string;
	codeVerifier: string;
	expiresAt: string;
	redirectUri: string;
	state: string;
};

export function createZaloOauthState(input: {
	actorUserId: string;
	redirectUri: string;
}) {
	const state = randomBytes(24).toString("base64url");
	const codeVerifier = randomBytes(48).toString("base64url");
	const payload: ZaloOauthState = {
		actorUserId: input.actorUserId,
		codeVerifier,
		expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
		redirectUri: input.redirectUri,
		state,
	};
	return {
		codeChallenge: createHash("sha256")
			.update(codeVerifier)
			.digest("base64url"),
		cookieValue: encryptZaloSecret(JSON.stringify(payload)),
		payload,
	};
}

export function readZaloOauthState(
	request: Request,
	expectedActorUserId: string,
) {
	const cookie = request.headers.get("cookie") ?? "";
	const value = cookie
		.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${ZALO_OAUTH_COOKIE}=`))
		?.slice(ZALO_OAUTH_COOKIE.length + 1);
	if (!value) throw new Error("Phiên kết nối Zalo OA không tồn tại.");
	const payload = JSON.parse(
		decryptZaloSecret(decodeURIComponent(value)),
	) as ZaloOauthState;
	if (
		payload.actorUserId !== expectedActorUserId ||
		Date.parse(payload.expiresAt) <= Date.now()
	) {
		throw new Error("Phiên kết nối Zalo OA đã hết hạn.");
	}
	return payload;
}

export function zaloOauthCookie(value: string, requestUrl: string) {
	const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
	return `${ZALO_OAUTH_COOKIE}=${encodeURIComponent(value)}; Path=/api/integrations/zalo/callback; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
}

export function clearZaloOauthCookie(requestUrl: string) {
	const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
	return `${ZALO_OAUTH_COOKIE}=; Path=/api/integrations/zalo/callback; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
