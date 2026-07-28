import { actorFromAuth } from "@/lib/chat/http";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { publicErrorMessage } from "@/lib/http/public-error";
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
