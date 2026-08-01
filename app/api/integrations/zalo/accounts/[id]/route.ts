import { z } from "zod";
import { revalidateTag } from "next/cache";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { publicErrorMessage } from "@/lib/http/public-error";
import {
	disconnectZaloConnection,
	setDefaultZaloConnection,
} from "@/lib/zalo/connections";
import { ZALO_ARTICLE_CATALOG_TAG } from "@/lib/zalo/cache-tags";

const idSchema = z.string().uuid();
const patchSchema = z.object({ isDefault: z.literal(true) }).strict();

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	try {
		const id = idSchema.parse((await params).id);
		patchSchema.parse(await request.json());
		const account = await setDefaultZaloConnection(id, actorFromAuth(auth));
		return account
			? Response.json({ account }, { headers: authHeaders(auth) })
			: Response.json({ error: "Không tìm thấy Zalo OA." }, { status: 404 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể cập nhật OA.") },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	try {
		const id = idSchema.parse((await params).id);
		const account = await disconnectZaloConnection(id, actorFromAuth(auth));
		if (account) revalidateTag(ZALO_ARTICLE_CATALOG_TAG, "max");
		return account
			? Response.json({ account }, { headers: authHeaders(auth) })
			: Response.json({ error: "Không tìm thấy Zalo OA." }, { status: 404 });
	} catch (error) {
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể ngắt kết nối OA.") },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
