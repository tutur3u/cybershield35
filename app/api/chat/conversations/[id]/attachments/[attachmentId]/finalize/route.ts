import { eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";

import {
	authHeaders,
	requirePlatformAdminSession,
} from "@/lib/auth/require-admin";
import { getOwnedAttachment, processChatAttachment } from "@/lib/chat/attachments";
import { chatError } from "@/lib/chat/http";
import { finalizeTuturuuuDriveUpload } from "@/lib/chat/tuturuuu-drive";
import { conversationIdSchema } from "@/lib/chat/types";
import { adminDb } from "@/lib/db/client";
import { chatAttachments } from "@/lib/db/schema";

const idSchema = z.string().uuid();

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ attachmentId: string; id: string }> },
) {
	const auth = await requirePlatformAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const values = await params;
		const conversationId = conversationIdSchema.parse(values.id);
		const attachmentId = idSchema.parse(values.attachmentId);
		const attachment = await getOwnedAttachment(attachmentId, conversationId, auth.session.user.id);
		if (!attachment?.drivePath || !attachment.storageProvider) {
			return Response.json({ error: "Không tìm thấy tệp tải lên." }, { status: 404 });
		}
		const finalized = await finalizeTuturuuuDriveUpload(auth.session.accessToken, {
			contentType: attachment.contentType,
			path: attachment.drivePath,
			provider: attachment.storageProvider as "r2" | "supabase",
			size: attachment.sizeBytes,
		});
		await adminDb
			.update(chatAttachments)
			.set({
				contentType: finalized.contentType,
				driveFullPath: finalized.fullPath,
				status: "processing",
				updatedAt: new Date(),
			})
			.where(eq(chatAttachments.id, attachment.id));
		const accessToken = auth.session.accessToken;
		after(() => processChatAttachment(attachment.id, accessToken));
		return Response.json(
			{ attachment: { ...attachment, status: "processing" } },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) return Response.json({ error: "ID không hợp lệ." }, { status: 400 });
		return chatError(error, "Không thể hoàn tất tải tệp.");
	}
}
