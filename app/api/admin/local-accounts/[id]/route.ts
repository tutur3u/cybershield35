import { z } from "zod";

import {
	deleteLocalAccount,
	LocalAccountError,
	updateLocalAccount,
} from "@/lib/auth/local-accounts";
import { MAX_LOCAL_USERNAME_LENGTH } from "@/lib/auth/local-password";
import {
	localAccountJson,
	requireLocalAccountAdmin,
} from "@/lib/local-accounts/admin-guard";

type Context = { params: Promise<{ id: string }> };

const patchSchema = z
	.object({
		disabled: z.boolean().optional(),
		displayName: z.string().trim().max(120).nullable().optional(),
		mustChangePassword: z.boolean().optional(),
		role: z.enum(["admin", "member"]).optional(),
		username: z.string().trim().min(1).max(MAX_LOCAL_USERNAME_LENGTH).optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: "Không có thay đổi nào.",
	});

export async function PATCH(request: Request, context: Context) {
	const guard = await requireLocalAccountAdmin(request);
	if (!guard.authorized) {
		return localAccountJson({ error: guard.error }, { status: guard.status });
	}

	const id = accountId(await context.params);
	if (!id) return localAccountJson({ error: "ID không hợp lệ." }, { status: 400 });

	const parsed = patchSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return localAccountJson(
			{ error: "Dữ liệu cập nhật không hợp lệ." },
			{ status: 400 },
		);
	}

	try {
		return localAccountJson(
			{ account: await updateLocalAccount(id, { ...parsed.data, actor: guard.actor }) },
			{ setCookie: guard.setCookie },
		);
	} catch (error) {
		return localAccountJson(
			{
				error:
					error instanceof LocalAccountError
						? error.message
						: "Không thể cập nhật tài khoản.",
			},
			{ status: error instanceof LocalAccountError ? error.status : 500 },
		);
	}
}

export async function DELETE(request: Request, context: Context) {
	const guard = await requireLocalAccountAdmin(request);
	if (!guard.authorized) {
		return localAccountJson({ error: guard.error }, { status: guard.status });
	}

	const id = accountId(await context.params);
	if (!id) return localAccountJson({ error: "ID không hợp lệ." }, { status: 400 });

	try {
		return localAccountJson(await deleteLocalAccount(id), {
			setCookie: guard.setCookie,
		});
	} catch (error) {
		return localAccountJson(
			{
				error:
					error instanceof LocalAccountError
						? error.message
						: "Không thể xóa tài khoản.",
			},
			{ status: error instanceof LocalAccountError ? error.status : 500 },
		);
	}
}

function accountId(params: { id: string }) {
	return z.uuid().safeParse(params.id).success ? params.id : null;
}
