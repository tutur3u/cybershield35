import { z } from "zod";

import {
	LocalAccountError,
	revokeLocalAccountSessions,
} from "@/lib/auth/local-accounts";
import {
	localAccountJson,
	requireLocalAccountAdmin,
} from "@/lib/local-accounts/admin-guard";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
	const guard = await requireLocalAccountAdmin(request);
	if (!guard.authorized) {
		return localAccountJson({ error: guard.error }, { status: guard.status });
	}

	const { id } = await context.params;
	if (!z.uuid().safeParse(id).success) {
		return localAccountJson({ error: "ID không hợp lệ." }, { status: 400 });
	}

	try {
		await revokeLocalAccountSessions(id);
		return localAccountJson({ revoked: true }, { setCookie: guard.setCookie });
	} catch (error) {
		return localAccountJson(
			{
				error:
					error instanceof LocalAccountError
						? error.message
						: "Không thể thu hồi phiên đăng nhập.",
			},
			{ status: error instanceof LocalAccountError ? error.status : 500 },
		);
	}
}
