import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { chatError } from "@/lib/chat/http";
import { requireOwnedChatConversation } from "@/lib/chat/store";
import { createTuturuuuDriveUpload } from "@/lib/chat/tuturuuu-drive";
import { conversationIdSchema } from "@/lib/chat/types";
import { adminDb } from "@/lib/db/client";
import { chatAttachments } from "@/lib/db/schema";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const allowedTypes = [
	"application/csv",
	"application/json",
	"application/msword",
	"application/pdf",
	"application/vnd.ms-excel",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"image/jpeg",
	"image/png",
	"image/webp",
	"text/csv",
	"text/markdown",
	"text/plain",
] as const;
const bodySchema = z
	.object({
		contentType: z.enum(allowedTypes),
		fileName: z.string().trim().min(1).max(240),
		size: z.number().int().positive().max(MAX_FILE_BYTES),
	})
	.strict();

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const conversationId = conversationIdSchema.parse((await params).id);
		const input = bodySchema.parse(await request.json());
		if (!(await requireOwnedChatConversation(conversationId, auth.session.user.id))) {
			return Response.json({ error: "Chỉ chủ sở hữu có thể tải tệp." }, { status: 403 });
		}
		const [pending] = await adminDb
			.select({ total: count() })
			.from(chatAttachments)
			.where(
				and(
					eq(chatAttachments.conversationId, conversationId),
					inArray(chatAttachments.status, ["pending_upload", "uploading", "processing"]),
				),
			);
		if ((pending?.total ?? 0) >= 5) {
			return Response.json({ error: "Tối đa 5 tệp đang chờ cho mỗi tin nhắn." }, { status: 409 });
		}

		const [attachment] = await adminDb
			.insert(chatAttachments)
			.values({
				contentType: input.contentType,
				conversationId,
				fileName: input.fileName,
				sizeBytes: input.size,
			})
			.returning();
		if (!attachment) throw new Error("Không thể tạo bản ghi tệp.");

		try {
			const upload = await createTuturuuuDriveUpload(auth.session.accessToken, {
				attachmentId: attachment.id,
				contentType: input.contentType,
				conversationId,
				filename: input.fileName,
				size: input.size,
			});
			await adminDb
				.update(chatAttachments)
				.set({
					driveFullPath: upload.fullPath,
					drivePath: upload.path,
					status: "uploading",
					storageProvider: upload.provider,
					updatedAt: new Date(),
				})
				.where(eq(chatAttachments.id, attachment.id));
			return Response.json(
				{ attachment: { ...attachment, drivePath: upload.path, status: "uploading" }, upload },
				{ status: 201, headers: authHeaders(auth) },
			);
		} catch (error) {
			await adminDb.delete(chatAttachments).where(eq(chatAttachments.id, attachment.id));
			throw error;
		}
	} catch (error) {
		if (error instanceof z.ZodError) return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		return chatError(error, "Không thể chuẩn bị tải tệp.");
	}
}
