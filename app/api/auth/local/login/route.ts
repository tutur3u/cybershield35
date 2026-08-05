import { z } from "zod";

import {
	authenticateLocalAccount,
	LocalAccountError,
} from "@/lib/auth/local-accounts";
import { createLocalSessionCookie } from "@/lib/auth/local-session";
import { MAX_LOCAL_PASSWORD_LENGTH } from "@/lib/auth/local-password";
import { safePostLoginPath } from "@/lib/auth/routes";
import { clearSessionCookie } from "@/lib/auth/tuturuuu-session";

const bodySchema = z
	.object({
		nextUrl: z.string().optional(),
		password: z.string().min(1).max(MAX_LOCAL_PASSWORD_LENGTH),
		username: z.string().trim().min(1).max(64),
	})
	.strict();

export async function POST(request: Request) {
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return Response.json(
			{ error: "Nhập tên đăng nhập và mật khẩu." },
			{ status: 400, headers: { "Cache-Control": "no-store" } },
		);
	}

	try {
		const session = await authenticateLocalAccount({
			password: parsed.data.password,
			userAgent: request.headers.get("user-agent"),
			username: parsed.data.username,
		});

		const headers = new Headers({ "Cache-Control": "no-store" });
		headers.append("Set-Cookie", createLocalSessionCookie(session));
		// Signing in locally must not leave a half-live Tuturuuu session behind.
		headers.append("Set-Cookie", clearSessionCookie());

		return Response.json(
			{
				mustChangePassword: session.mustChangePassword,
				redirectTo: safePostLoginPath(
					parsed.data.nextUrl,
					new URL(request.url).origin,
				),
			},
			{ headers },
		);
	} catch (error) {
		const status = error instanceof LocalAccountError ? error.status : 500;
		return Response.json(
			{
				error:
					error instanceof LocalAccountError
						? error.message
						: "Không thể đăng nhập. Thử lại sau.",
			},
			{ status, headers: { "Cache-Control": "no-store" } },
		);
	}
}
