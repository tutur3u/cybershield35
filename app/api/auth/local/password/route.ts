import { z } from "zod";

import {
	changeOwnLocalPassword,
	LocalAccountError,
} from "@/lib/auth/local-accounts";
import { MAX_LOCAL_PASSWORD_LENGTH } from "@/lib/auth/local-password";
import { readLocalSessionCookie } from "@/lib/auth/local-session";

const bodySchema = z
	.object({
		currentPassword: z.string().min(1).max(MAX_LOCAL_PASSWORD_LENGTH),
		newPassword: z.string().min(1).max(MAX_LOCAL_PASSWORD_LENGTH),
	})
	.strict();

export async function POST(request: Request) {
	const session = readLocalSessionCookie(request);
	if (!session) {
		return Response.json(
			{ error: "Chỉ tài khoản đăng nhập bằng mật khẩu mới đổi được mật khẩu." },
			{ status: 403, headers: { "Cache-Control": "no-store" } },
		);
	}

	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return Response.json(
			{ error: "Nhập mật khẩu hiện tại và mật khẩu mới." },
			{ status: 400, headers: { "Cache-Control": "no-store" } },
		);
	}

	try {
		await changeOwnLocalPassword({
			accountId: session.accountId,
			currentPassword: parsed.data.currentPassword,
			newPassword: parsed.data.newPassword,
			sessionId: session.sessionId,
		});
		return Response.json(
			{ ok: true },
			{ headers: { "Cache-Control": "no-store" } },
		);
	} catch (error) {
		const status = error instanceof LocalAccountError ? error.status : 500;
		return Response.json(
			{
				error:
					error instanceof LocalAccountError
						? error.message
						: "Không thể đổi mật khẩu.",
			},
			{ status, headers: { "Cache-Control": "no-store" } },
		);
	}
}
