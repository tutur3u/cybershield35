import { actorFromAuth } from "@/lib/chat/http";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { publicErrorMessage } from "@/lib/http/public-error";
import {
	exchangeZaloAuthorizationCode,
	fetchZaloOaProfile,
} from "@/lib/zalo/client";
import { upsertZaloConnection } from "@/lib/zalo/connections";
import {
	clearZaloOauthCookie,
	readZaloOauthState,
} from "@/lib/zalo/oauth-state";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return redirectResult(request.url, "error", auth.error);
	}
	const url = new URL(request.url);
	try {
		const actor = actorFromAuth(auth);
		const code = url.searchParams.get("code");
		const oaId = url.searchParams.get("oa_id");
		const state = url.searchParams.get("state");
		const providerError =
			url.searchParams.get("error_description") ?? url.searchParams.get("error");
		if (providerError) throw new Error(providerError);
		if (!code || !oaId || !state) {
			throw new Error("Zalo không trả về đủ mã ủy quyền và OA ID.");
		}
		const pending = readZaloOauthState(request, actor.id);
		if (pending.state !== state) {
			throw new Error("Trạng thái OAuth Zalo không hợp lệ.");
		}
		const tokens = await exchangeZaloAuthorizationCode({
			code,
			codeVerifier: pending.codeVerifier,
			redirectUri: pending.redirectUri,
		});
		const profile = await fetchZaloOaProfile(tokens.accessToken, oaId).catch(
			() => ({
				avatarUrl: null,
				displayName: `Zalo OA ${oaId}`,
				oaId,
			}),
		);
		await upsertZaloConnection(profile, tokens, actor);
		const response = redirectResult(
			request.url,
			"connected",
			`Đã kết nối ${profile.displayName}.`,
		);
		if (auth.setCookie) response.headers.append("Set-Cookie", auth.setCookie);
		return response;
	} catch (error) {
		return redirectResult(
			request.url,
			"error",
			publicErrorMessage(error, "Không thể kết nối Zalo OA."),
		);
	}
}

function redirectResult(
	requestUrl: string,
	status: "connected" | "error",
	message: string,
) {
	const target = new URL("/settings", requestUrl);
	target.searchParams.set("zalo", status);
	target.searchParams.set("message", message.slice(0, 300));
	const response = new Response(null, {
		headers: { Location: target.toString() },
		status: 302,
	});
	response.headers.append("Set-Cookie", clearZaloOauthCookie(requestUrl));
	return response;
}
