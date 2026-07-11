import { z } from "zod";
import { after } from "next/server";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { chatError } from "@/lib/chat/http";
import { cleanupDeletedConversation } from "@/lib/chat/attachments";
import {
	getChatConversation,
	softDeleteChatConversation,
	updateChatConversation,
} from "@/lib/chat/store";
import { conversationIdSchema, updateConversationSchema } from "@/lib/chat/types";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const id = conversationIdSchema.parse((await context.params).id);
		const chat = await getChatConversation(id, auth.session.user.id);
		if (!chat) return Response.json({ error: "Không tìm thấy cuộc trò chuyện." }, { status: 404 });
		return Response.json(chat, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) return Response.json({ error: "ID không hợp lệ." }, { status: 400 });
		return chatError(error, "Không thể tải cuộc trò chuyện.");
	}
}

export async function PATCH(request: Request, context: Context) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const id = conversationIdSchema.parse((await context.params).id);
		const patch = updateConversationSchema.parse(await request.json());
		const conversation = await updateChatConversation(id, auth.session.user.id, patch);
		if (!conversation) return Response.json({ error: "Chỉ chủ sở hữu có thể cập nhật Chat." }, { status: 403 });
		return Response.json({ conversation }, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		return chatError(error, "Không thể cập nhật cuộc trò chuyện.");
	}
}

export async function DELETE(request: Request, context: Context) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const id = conversationIdSchema.parse((await context.params).id);
		const conversation = await softDeleteChatConversation(id, auth.session.user.id);
		if (!conversation) return Response.json({ error: "Chỉ chủ sở hữu có thể xóa Chat." }, { status: 403 });
		const token = auth.session.accessToken;
		after(() => cleanupDeletedConversation(id, token));
		return Response.json({ deleted: true }, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) return Response.json({ error: "ID không hợp lệ." }, { status: 400 });
		return chatError(error, "Không thể xóa cuộc trò chuyện.");
	}
}
