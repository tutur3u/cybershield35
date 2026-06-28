import { z } from "zod";

import {
	buildTuturuuuApiUrl,
	getBearerForPlatformRequest,
	sanitizeAuthError,
} from "@/lib/auth/tuturuuu-session";
import {
	buildTuturuuuScopeApprovalUrlForRequest,
	isTuturuuuScopeNotAllowedError,
} from "@/lib/auth/scope-approval";
import { createAvatarUploadProof } from "@/lib/auth/avatar-upload-proof";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const avatarUploadSchema = z
	.object({
		contentType: z.enum([
			"image/gif",
			"image/jpeg",
			"image/png",
			"image/webp",
		]),
		filename: z
			.string()
			.trim()
			.min(3)
			.max(160)
			.regex(/^[^\\/]+\.(gif|jpe?g|png|webp)$/iu),
		size: z.number().int().positive().max(MAX_AVATAR_SIZE_BYTES),
	})
	.strict();

const uploadResponseSchema = z
	.object({
		filePath: z.string().min(1),
		publicUrl: z.url(),
		uploadUrl: z.url(),
	})
	.passthrough();

export async function POST(request: Request) {
	try {
		const auth = await getBearerForPlatformRequest(request);
		const parsed = avatarUploadSchema.safeParse(await request.json());
		if (!parsed.success) {
			return json({ error: "Invalid avatar upload payload" }, { status: 400 });
		}

		const response = await fetch(
			buildTuturuuuApiUrl("users/me/avatar/upload-url"),
			{
				body: JSON.stringify({ filename: parsed.data.filename }),
				cache: "no-store",
				headers: {
					Authorization: auth.authorization,
					"Content-Type": "application/json",
				},
				method: "POST",
			},
		);
		const body = await readJson(response);
		if (!response.ok) {
			return json(body ?? { error: "Tuturuuu avatar upload request failed" }, {
				setCookie: auth.setCookie,
				status: response.status,
			});
		}

		const upload = uploadResponseSchema.parse(body);
		return json(
			{
				filePath: upload.filePath,
				publicUrl: upload.publicUrl,
				uploadProof: createAvatarUploadProof({
					filePath: upload.filePath,
					publicUrl: upload.publicUrl,
					userId: auth.session.user.id,
				}),
				uploadUrl: upload.uploadUrl,
			},
			{ setCookie: auth.setCookie },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json({ error: "Invalid avatar upload response" }, { status: 502 });
		}

		const safe = sanitizeAuthError(error);
		return json(scopeAwareErrorBody(safe, request), { status: safe.status });
	}
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

function scopeAwareErrorBody(
	safe: { message: string; status: number },
	request: Request,
) {
	return {
		error: safe.message,
		scopeApprovalHref: isTuturuuuScopeNotAllowedError({
			error: safe.message,
			status: safe.status,
		})
			? buildTuturuuuScopeApprovalUrlForRequest(request)
			: undefined,
	};
}
