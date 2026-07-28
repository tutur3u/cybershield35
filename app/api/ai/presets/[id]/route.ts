import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { adminDb } from "@/lib/db/client";
import { aiPromptPresets } from "@/lib/db/schema";

const idSchema = z.string().uuid();
const patchSchema = z
	.object({
		description: z.string().trim().max(500).nullable().optional(),
		instructions: z.string().trim().min(1).max(4_000).optional(),
		name: z.string().trim().min(1).max(120).optional(),
		tone: z.string().trim().max(120).nullable().optional(),
		visibility: z.enum(["private", "workspace"]).optional(),
		voice: z.string().trim().max(120).nullable().optional(),
	})
	.refine((value) => Object.keys(value).length > 0, "Missing update")
	.strict();

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const id = idSchema.parse((await params).id);
		const patch = patchSchema.parse(await request.json());
		const [preset] = await adminDb
			.update(aiPromptPresets)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(aiPromptPresets.id, id),
					eq(aiPromptPresets.ownerUserId, auth.session.user.id),
				),
			)
			.returning();
		return preset
			? Response.json({ preset }, { headers: authHeaders(auth) })
			: Response.json({ error: "Chỉ người tạo có thể sửa preset." }, { status: 403 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return Response.json({ error: "Không thể cập nhật preset." }, { status: 500 });
	}
}
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const id = idSchema.parse((await params).id);
		const [preset] = await adminDb
			.delete(aiPromptPresets)
			.where(
				and(
					eq(aiPromptPresets.id, id),
					eq(aiPromptPresets.ownerUserId, auth.session.user.id),
				),
			)
			.returning();
		return preset
			? Response.json({ deleted: true }, { headers: authHeaders(auth) })
			: Response.json({ error: "Chỉ người tạo có thể xóa preset." }, { status: 403 });
	} catch {
		return Response.json({ error: "Không thể xóa preset." }, { status: 500 });
	}
}
