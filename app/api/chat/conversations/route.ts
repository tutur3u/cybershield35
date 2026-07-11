import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth, chatError } from "@/lib/chat/http";
import {
	createChatConversation,
	listChatConversations,
} from "@/lib/chat/store";
import { createConversationSchema } from "@/lib/chat/types";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		return Response.json(
			{ conversations: await listChatConversations(auth.session.user.id) },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return chatError(error, "Không thể tải cuộc trò chuyện.");
	}
}

export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const input = createConversationSchema.parse(await request.json().catch(() => ({})));
		const conversation = await createChatConversation(actorFromAuth(auth), input.title);
		return Response.json({ conversation }, { status: 201, headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return chatError(error, "Không thể tạo cuộc trò chuyện.");
	}
}
