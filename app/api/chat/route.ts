import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { generateChatReply } from "@/lib/llm/generation";

export const runtime = "nodejs";

const chatBodySchema = z.object({
	messages: z
		.array(
			z.object({
				role: z.enum(["assistant", "user"]),
				content: z.string().min(1).max(8000),
			}),
		)
		.min(1)
		.max(24),
}).strict();

export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const body = chatBodySchema.parse(await request.json());
		const reply = await generateChatReply(body.messages);

		return Response.json({ reply }, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}

		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Không thể gửi tin nhắn chat.",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
