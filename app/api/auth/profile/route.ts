import { z } from "zod";

import {
	buildTuturuuuApiUrl,
	createSessionCookie,
	getBearerForPlatformRequest,
	refreshAdminSession,
	sanitizeAuthError,
	toSafeSession,
	type SafeAdminSession,
} from "@/lib/auth/tuturuuu-session";

export const runtime = "nodejs";

const MAX_DISPLAY_NAME_LENGTH = 100;

const profilePatchSchema = z
	.object({
		avatar_url: z
			.preprocess((value) => (value === "" ? null : value), z.url().nullable())
			.optional(),
		display_name: z
			.preprocess(
				(value) => (typeof value === "string" ? value.trim() : value),
				z.string().min(1).max(MAX_DISPLAY_NAME_LENGTH),
			)
			.optional(),
	})
	.strict();

const profileResponseSchema = z
	.object({
		avatar_url: z.string().nullable().optional(),
		display_name: z.string().nullable().optional(),
	})
	.passthrough();

type SafeProfile = {
	avatar_url: string | null;
	display_name: string | null;
};

export async function GET(request: Request) {
	try {
		const auth = await getBearerForPlatformRequest(request);
		const response = await fetch(buildTuturuuuApiUrl("users/me/profile"), {
			cache: "no-store",
			headers: { Authorization: auth.authorization },
			method: "GET",
		});
		const body = await readJson(response);
		if (!response.ok) {
			return json(body ?? { error: "Tuturuuu profile request failed" }, {
				status: response.status,
				setCookie: auth.setCookie,
			});
		}

		const safeSession = toSafeSession(auth.session);
		const parsed = profileResponseSchema.safeParse(body);
		return json(
			{
				profile: parsed.success
					? toSafeProfileFromProfile(parsed.data)
					: toSafeProfileFromSession(safeSession),
				session: safeSession,
			},
			{ setCookie: auth.setCookie },
		);
	} catch (error) {
		const safe = sanitizeAuthError(error);
		return json({ error: safe.message }, { status: safe.status });
	}
}

export async function PATCH(request: Request) {
	try {
		const auth = await getBearerForPlatformRequest(request);
		const parsed = profilePatchSchema.safeParse(await request.json());
		if (!parsed.success || Object.keys(parsed.data).length === 0) {
			return json({ error: "Invalid profile payload" }, { status: 400 });
		}

		const response = await fetch(buildTuturuuuApiUrl("users/me/profile"), {
			body: JSON.stringify(parsed.data),
			cache: "no-store",
			headers: {
				Authorization: auth.authorization,
				"Content-Type": "application/json",
			},
			method: "PATCH",
		});
		const body = await readJson(response);
		if (!response.ok) {
			return json(body ?? { error: "Tuturuuu profile update failed" }, {
				status: response.status,
				setCookie: auth.setCookie,
			});
		}

		const refreshedSession = await refreshAdminSession(auth.session);
		const safeSession = toSafeSession(refreshedSession);
		return json(
			{
				profile: toSafeProfileFromSession(safeSession),
				session: safeSession,
			},
			{ setCookie: createSessionCookie(refreshedSession) },
		);
	} catch (error) {
		const safe = sanitizeAuthError(error);
		return json({ error: safe.message }, { status: safe.status });
	}
}

function toSafeProfileFromProfile(profile: z.infer<typeof profileResponseSchema>) {
	return {
		avatar_url: profile.avatar_url ?? null,
		display_name: profile.display_name ?? null,
	} satisfies SafeProfile;
}

function toSafeProfileFromSession(session: SafeAdminSession) {
	return {
		avatar_url: session.user.avatarUrl,
		display_name: session.user.displayName,
	} satisfies SafeProfile;
}

async function readJson(response: Response) {
	return response.json().catch(() => null) as Promise<unknown>;
}

function json(
	body: unknown,
	options: { setCookie?: string | null; status?: number } = {},
) {
	const headers = new Headers({ "Cache-Control": "no-store" });
	if (options.setCookie) headers.set("Set-Cookie", options.setCookie);
	return Response.json(body, { headers, status: options.status });
}
