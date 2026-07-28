import { actorFromAuth } from "@/lib/chat/http";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { publicErrorMessage } from "@/lib/http/public-error";
import { logOperation } from "@/lib/operations/telemetry";
import {
	buildZaloAuthorizationUrl,
	getZaloConfig,
	isZaloEnabled,
} from "@/lib/zalo/client";
import {
	createZaloOauthState,
	zaloOauthCookie,
} from "@/lib/zalo/oauth-state";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	if (!isZaloEnabled()) {
		return Response.json(
			{ error: "Tích hợp Zalo OA đang bị tắt bởi feature flag." },
			{ status: 503, headers: authHeaders(auth) },
		);
	}
	try {
		const actor = actorFromAuth(auth);
		const { redirectUri } = getZaloConfig(request.url);
		const oauth = createZaloOauthState({
			actorUserId: actor.id,
			redirectUri,
		});
		const response = Response.redirect(
			buildZaloAuthorizationUrl({
				codeChallenge: oauth.codeChallenge,
				redirectUri,
				state: oauth.payload.state,
			}),
			302,
		);
		response.headers.append(
			"Set-Cookie",
			zaloOauthCookie(oauth.cookieValue, request.url),
		);
		if (auth.setCookie) response.headers.append("Set-Cookie", auth.setCookie);
		return response;
	} catch (error) {
		logOperation(
			"zalo_oauth_start_failed",
			{
				errorType: error instanceof Error ? error.name : "UnknownError",
				reason: safeOauthStartFailureReason(error),
			},
			"error",
		);
		return Response.json(
			{
				error: publicErrorMessage(
					error,
					"Không thể bắt đầu kết nối Zalo OA.",
				),
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}

function safeOauthStartFailureReason(error: unknown) {
	if (!(error instanceof Error)) return "unknown";
	for (const key of [
		"ZALO_APP_ID",
		"ZALO_APP_SECRET",
		"ZALO_REDIRECT_URI",
		"ZALO_TOKEN_ENCRYPTION_KEY",
	] as const) {
		if (error.message.includes(key)) return `${key.toLowerCase()}_invalid`;
	}
	if (/key length|invalid key/iu.test(error.message)) {
		return "zalo_token_encryption_key_invalid";
	}
	return "unknown";
}
