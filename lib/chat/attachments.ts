import "server-only";

import { Firecrawl } from "firecrawl";
import { and, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { generateText } from "ai";

import { adminDb } from "@/lib/db/client";
import {
	chatAttachmentChunks,
	chatAttachments,
	chatConversations,
} from "@/lib/db/schema";
import { getChatModelRuntime } from "@/lib/llm/generation";
import { resolveCredential } from "@/lib/runtime/client-runtime";

import {
	createTuturuuuDriveReadUrl,
	deleteTuturuuuDriveObject,
} from "./tuturuuu-drive";

const TEXT_TYPES = new Set([
	"application/csv",
	"application/json",
	"text/csv",
	"text/markdown",
	"text/plain",
]);

export async function getOwnedAttachment(
	attachmentId: string,
	conversationId: string,
	actorId: string,
) {
	const [attachment] = await adminDb
		.select({ attachment: chatAttachments })
		.from(chatAttachments)
		.innerJoin(
			chatConversations,
			eq(chatConversations.id, chatAttachments.conversationId),
		)
		.where(
			and(
				eq(chatAttachments.id, attachmentId),
				eq(chatAttachments.conversationId, conversationId),
				eq(chatConversations.ownerUserId, actorId),
			),
		)
		.limit(1);
	return attachment?.attachment ?? null;
}

export async function getAccessibleAttachment(
	attachmentId: string,
	conversationId: string,
	actorId: string,
) {
	const [attachment] = await adminDb
		.select({ attachment: chatAttachments })
		.from(chatAttachments)
		.innerJoin(chatConversations, eq(chatConversations.id, chatAttachments.conversationId))
		.where(
			and(
				eq(chatAttachments.id, attachmentId),
				eq(chatAttachments.conversationId, conversationId),
				isNull(chatConversations.deletedAt),
				or(
					eq(chatConversations.ownerUserId, actorId),
					eq(chatConversations.visibility, "workspace"),
				),
			),
		)
		.limit(1);
	return attachment?.attachment ?? null;
}

export async function processChatAttachment(
	attachmentId: string,
	accessToken: string,
) {
	const [attachment] = await adminDb
		.select()
		.from(chatAttachments)
		.where(eq(chatAttachments.id, attachmentId))
		.limit(1);
	if (!attachment?.drivePath || !attachment.storageProvider) return;

	const startedAt = new Date();
	await adminDb
		.update(chatAttachments)
		.set({
			attempts: sql`${chatAttachments.attempts} + 1`,
			errorMessage: null,
			lockedAt: startedAt,
			status: "processing",
			updatedAt: startedAt,
		})
		.where(eq(chatAttachments.id, attachment.id));

	try {
		const read = await createTuturuuuDriveReadUrl(accessToken, {
			path: attachment.drivePath,
			provider: attachment.storageProvider as "r2" | "supabase",
		});
		const response = await fetch(read.signedUrl, { cache: "no-store" });
		if (!response.ok) throw new Error(`Drive read failed (${response.status})`);
		const bytes = new Uint8Array(await response.arrayBuffer());
		if (bytes.byteLength !== attachment.sizeBytes) {
			throw new Error("Drive object size changed after finalize");
		}

		const extracted = await extractAttachmentText({
			bytes,
			contentType: attachment.contentType,
			fileName: attachment.fileName,
		});
		const chunks = chunkText(extracted.text);
		await adminDb.transaction(async (tx) => {
			await tx
				.delete(chatAttachmentChunks)
				.where(eq(chatAttachmentChunks.attachmentId, attachment.id));
			if (chunks.length > 0) {
				await tx.insert(chatAttachmentChunks).values(
					chunks.map((content, ordinal) => ({
						attachmentId: attachment.id,
						content,
						metadata: { extractor: extracted.extractor },
						ordinal,
					})),
				);
			}
			await tx
				.update(chatAttachments)
				.set({
					extractionMetadata: {
						characters: extracted.text.length,
						chunks: chunks.length,
						extractor: extracted.extractor,
					},
					lockedAt: null,
					processedAt: new Date(),
					status: "ready",
					updatedAt: new Date(),
				})
				.where(eq(chatAttachments.id, attachment.id));
		});
	} catch (error) {
		await adminDb
			.update(chatAttachments)
			.set({
				errorMessage:
					error instanceof Error ? error.message.slice(0, 500) : "Attachment processing failed",
				lockedAt: null,
				status: "failed",
				updatedAt: new Date(),
			})
			.where(eq(chatAttachments.id, attachment.id));
	}
}

export async function deleteChatAttachment(
	attachmentId: string,
	accessToken: string,
) {
	const [attachment] = await adminDb
		.select()
		.from(chatAttachments)
		.where(eq(chatAttachments.id, attachmentId))
		.limit(1);
	if (!attachment) return false;
	if (attachment.drivePath) {
		await deleteTuturuuuDriveObject(accessToken, { path: attachment.drivePath });
	}
	await adminDb.transaction(async (tx) => {
		await tx
			.delete(chatAttachmentChunks)
			.where(eq(chatAttachmentChunks.attachmentId, attachment.id));
		await tx
			.update(chatAttachments)
			.set({
				deletedAt: new Date(),
				driveFullPath: null,
				drivePath: null,
				status: "deleted",
				updatedAt: new Date(),
			})
			.where(eq(chatAttachments.id, attachment.id));
	});
	return true;
}

export async function cleanupDeletedConversation(
	conversationId: string,
	accessToken: string,
) {
	const attachments = await adminDb
		.select({ id: chatAttachments.id })
		.from(chatAttachments)
		.where(
			and(
				eq(chatAttachments.conversationId, conversationId),
				ne(chatAttachments.status, "deleted"),
			),
		);
	for (const attachment of attachments) {
		try {
			await deleteChatAttachment(attachment.id, accessToken);
		} catch (error) {
			await adminDb
				.update(chatAttachments)
				.set({
					errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Drive cleanup failed",
					lockedAt: null,
					status: "deleting",
					updatedAt: new Date(),
				})
				.where(eq(chatAttachments.id, attachment.id));
		}
	}
	const [remaining] = await adminDb
		.select({ count: sql<number>`count(*)::int` })
		.from(chatAttachments)
		.where(
			and(
				eq(chatAttachments.conversationId, conversationId),
				ne(chatAttachments.status, "deleted"),
			),
		);
	if ((remaining?.count ?? 0) === 0) {
		await adminDb
			.delete(chatConversations)
			.where(eq(chatConversations.id, conversationId));
		return true;
	}
	return false;
}

export async function searchAttachmentChunks(
	conversationId: string,
	query: string,
	limit = 8,
) {
	const terms = query.trim().slice(0, 200);
	if (!terms) return [];
	return adminDb
		.select({
			attachmentId: chatAttachmentChunks.attachmentId,
			content: chatAttachmentChunks.content,
			fileName: chatAttachments.fileName,
			ordinal: chatAttachmentChunks.ordinal,
		})
		.from(chatAttachmentChunks)
		.innerJoin(
			chatAttachments,
			eq(chatAttachments.id, chatAttachmentChunks.attachmentId),
		)
		.where(
			and(
				eq(chatAttachments.conversationId, conversationId),
				eq(chatAttachments.status, "ready"),
				orTextSearch(terms),
			),
		)
		.limit(Math.min(Math.max(limit, 1), 12));
}

function orTextSearch(query: string) {
	return query.split(/\s+/u).filter(Boolean).length > 1
		? sql`to_tsvector('simple', ${chatAttachmentChunks.content}) @@ plainto_tsquery('simple', ${query})`
		: ilike(chatAttachmentChunks.content, `%${query}%`);
}

async function extractAttachmentText(input: {
	bytes: Uint8Array;
	contentType: string;
	fileName: string;
}) {
	if (TEXT_TYPES.has(input.contentType)) {
		return { extractor: "local-text", text: new TextDecoder().decode(input.bytes) };
	}

	if (input.contentType.startsWith("image/")) {
		const runtime = getChatModelRuntime();
		if (!runtime) throw new Error("LLM provider is required for image processing");
		const { text } = await generateText({
			model: runtime.model,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Trích xuất toàn bộ văn bản nhìn thấy và mô tả ngắn nội dung ảnh bằng tiếng Việt. Không suy đoán danh tính.",
						},
						{ data: input.bytes, mediaType: input.contentType, type: "file" },
					],
				},
			],
		});
		return { extractor: "multimodal", text };
	}

	const credential = resolveCredential(process.env.FIRECRAWL_API_KEY);
	if (!credential) throw new Error("FIRECRAWL_API_KEY is required for document processing");
	const client = new Firecrawl({ apiKey: credential.value });
	const result = await client.parse(
		{
			contentType: input.contentType,
			data: Buffer.from(input.bytes),
			filename: input.fileName,
		},
		{ formats: ["markdown"] },
	);
	return { extractor: "firecrawl", text: result.markdown ?? "" };
}

function chunkText(value: string) {
	const normalized = value.replace(/\r\n/gu, "\n").trim().slice(0, 200_000);
	if (!normalized) return [];
	const chunks: string[] = [];
	for (let start = 0; start < normalized.length && chunks.length < 160; start += 1_000) {
		chunks.push(normalized.slice(start, start + 1_200));
	}
	return chunks;
}
