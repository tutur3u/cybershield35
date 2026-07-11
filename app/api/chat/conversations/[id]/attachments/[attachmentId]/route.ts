import { eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import {
	deleteChatAttachment,
	getAccessibleAttachment,
	getOwnedAttachment,
	processChatAttachment,
} from "@/lib/chat/attachments";
import { chatError } from "@/lib/chat/http";
import { createTuturuuuDriveReadUrl } from "@/lib/chat/tuturuuu-drive";
import { conversationIdSchema } from "@/lib/chat/types";
import { adminDb } from "@/lib/db/client";
import { chatAttachments } from "@/lib/db/schema";

const idSchema = z.string().uuid();
type Context = { params: Promise<{ attachmentId: string; id: string }> };

async function ownedAttachment(request: Request, context: Context) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return { auth, attachment: null };
	const values = await context.params;
	const conversationId = conversationIdSchema.parse(values.id);
	const attachmentId = idSchema.parse(values.attachmentId);
	const attachment = await getOwnedAttachment(attachmentId, conversationId, auth.session.user.id);
	return { auth, attachment };
}

export async function GET(request: Request, context: Context) {
	try {
		const auth = await requireAdminSession(request);
		if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
		const values = await context.params;
		const attachment = await getAccessibleAttachment(
			idSchema.parse(values.attachmentId),
			conversationIdSchema.parse(values.id),
			auth.session.user.id,
		);
		if (!attachment?.drivePath || !attachment.storageProvider) return Response.json({ error: "Không tìm thấy tệp." }, { status: 404 });
		const read = await createTuturuuuDriveReadUrl(auth.session.accessToken, {
			path: attachment.drivePath,
			provider: attachment.storageProvider as "r2" | "supabase",
		});
		return Response.json({ ...read, fileName: attachment.fileName }, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) return Response.json({ error: "ID không hợp lệ." }, { status: 400 });
		return chatError(error, "Không thể mở tệp.");
	}
}

export async function POST(request: Request, context: Context) {
	try {
		const { auth, attachment } = await ownedAttachment(request, context);
		if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
		if (!attachment || !["failed", "processing"].includes(attachment.status)) return Response.json({ error: "Tệp chưa sẵn sàng để thử lại." }, { status: 409 });
		await adminDb
			.update(chatAttachments)
			.set({ errorMessage: null, scheduledAt: new Date(), status: "processing", updatedAt: new Date() })
			.where(eq(chatAttachments.id, attachment.id));
		const token = auth.session.accessToken;
		after(() => processChatAttachment(attachment.id, token));
		return Response.json({ retried: true }, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) return Response.json({ error: "ID không hợp lệ." }, { status: 400 });
		return chatError(error, "Không thể thử lại xử lý tệp.");
	}
}

export async function DELETE(request: Request, context: Context) {
	try {
		const { auth, attachment } = await ownedAttachment(request, context);
		if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
		if (!attachment) return Response.json({ error: "Không tìm thấy tệp." }, { status: 404 });
		await deleteChatAttachment(attachment.id, auth.session.accessToken);
		return Response.json({ deleted: true }, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) return Response.json({ error: "ID không hợp lệ." }, { status: 400 });
		return chatError(error, "Không thể xóa tệp.");
	}
}
