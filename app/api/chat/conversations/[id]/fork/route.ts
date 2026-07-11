import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth, chatError } from "@/lib/chat/http";
import { forkChatConversation } from "@/lib/chat/store";
import { conversationIdSchema } from "@/lib/chat/types";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const id = conversationIdSchema.parse((await params).id);
		const conversation = await forkChatConversation(id, actorFromAuth(auth));
		if (!conversation) return Response.json({ error: "Chat được chia sẻ không còn khả dụng." }, { status: 404 });
		return Response.json({ conversation }, { status: 201, headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) return Response.json({ error: "ID không hợp lệ." }, { status: 400 });
		return chatError(error, "Không thể sao chép cuộc trò chuyện.");
	}
}
