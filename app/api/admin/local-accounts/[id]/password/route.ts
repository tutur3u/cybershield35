import { z } from "zod";

import {
	LocalAccountError,
	setLocalAccountPassword,
} from "@/lib/auth/local-accounts";
import { MAX_LOCAL_PASSWORD_LENGTH } from "@/lib/auth/local-password";
import {
	localAccountJson,
	requireLocalAccountAdmin,
} from "@/lib/local-accounts/admin-guard";

type Context = { params: Promise<{ id: string }> };

const bodySchema = z
	.object({
		mustChangePassword: z.boolean().optional(),
		password: z.string().max(MAX_LOCAL_PASSWORD_LENGTH).optional(),
	})
	.strict();

export async function POST(request: Request, context: Context) {
	const guard = await requireLocalAccountAdmin(request);
	if (!guard.authorized) {
		return localAccountJson({ error: guard.error }, { status: guard.status });
	}

	const { id } = await context.params;
	if (!z.uuid().safeParse(id).success) {
		return localAccountJson({ error: "ID không hợp lệ." }, { status: 400 });
	}

	const parsed = bodySchema.safeParse((await request.json().catch(() => null)) ?? {});
	if (!parsed.success) {
		return localAccountJson({ error: "Mật khẩu không hợp lệ." }, { status: 400 });
	}

	try {
		return localAccountJson(
			await setLocalAccountPassword(id, {
				actor: guard.actor,
				mustChangePassword: parsed.data.mustChangePassword,
				password: parsed.data.password,
			}),
			{ setCookie: guard.setCookie },
		);
	} catch (error) {
		return localAccountJson(
			{
				error:
					error instanceof LocalAccountError
						? error.message
						: "Không thể đặt lại mật khẩu.",
			},
			{ status: error instanceof LocalAccountError ? error.status : 500 },
		);
	}
}
