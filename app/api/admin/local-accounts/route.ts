import { z } from "zod";

import {
	createLocalAccount,
	listLocalAccounts,
	LocalAccountError,
} from "@/lib/auth/local-accounts";
import {
	MAX_LOCAL_PASSWORD_LENGTH,
	MAX_LOCAL_USERNAME_LENGTH,
} from "@/lib/auth/local-password";
import {
	localAccountJson,
	requireLocalAccountAdmin,
} from "@/lib/local-accounts/admin-guard";

const createSchema = z
	.object({
		displayName: z.string().trim().max(120).optional(),
		mustChangePassword: z.boolean().optional(),
		password: z.string().max(MAX_LOCAL_PASSWORD_LENGTH).optional(),
		role: z.enum(["admin", "member"]).optional(),
		username: z.string().trim().min(1).max(MAX_LOCAL_USERNAME_LENGTH),
	})
	.strict();

export async function GET(request: Request) {
	const guard = await requireLocalAccountAdmin(request);
	if (!guard.authorized) {
		return localAccountJson(
			{ accounts: [], context: { canManage: false, reason: guard.error } },
			{ status: guard.status },
		);
	}

	try {
		return localAccountJson(
			{ accounts: await listLocalAccounts(), context: { canManage: true } },
			{ setCookie: guard.setCookie },
		);
	} catch {
		return localAccountJson(
			{ error: "Không thể tải danh sách tài khoản mật khẩu." },
			{ status: 500 },
		);
	}
}

export async function POST(request: Request) {
	const guard = await requireLocalAccountAdmin(request);
	if (!guard.authorized) {
		return localAccountJson({ error: guard.error }, { status: guard.status });
	}

	const parsed = createSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return localAccountJson(
			{ error: "Dữ liệu tài khoản không hợp lệ." },
			{ status: 400 },
		);
	}

	try {
		const created = await createLocalAccount({
			actor: guard.actor,
			displayName: parsed.data.displayName,
			mustChangePassword: parsed.data.mustChangePassword,
			password: parsed.data.password,
			role: parsed.data.role,
			username: parsed.data.username,
		});
		return localAccountJson(created, {
			setCookie: guard.setCookie,
			status: 201,
		});
	} catch (error) {
		return localAccountJson(
			{
				error:
					error instanceof LocalAccountError
						? error.message
						: "Không thể tạo tài khoản.",
			},
			{ status: error instanceof LocalAccountError ? error.status : 500 },
		);
	}
}
