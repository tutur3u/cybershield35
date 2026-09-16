import { unchangedRow } from "@/lib/db/d1-guard";
import "server-only";

import { Firecrawl } from "firecrawl";
import { and, eq,  isNull, ne, or, sql } from "drizzle-orm";
import { containsInsensitive } from "@/lib/db/sqlite-search";
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
	const [claimed] = await adminDb
		.update(chatAttachments)
		.set({
			attempts: sql`${chatAttachments.attempts} + 1`,
			errorMessage: null,
			lockedAt: startedAt,
			status: "processing",
			updatedAt: startedAt,
		})
		.where(and(eq(chatAttachments.id, attachment.id),
            ne(chatAttachments.status,"deleting"),ne(chatAttachments.status,"deleted"),
            or(ne(chatAttachments.status,"processing"), sql`${chatAttachments.lockedAt} < ${new Date(Date.now()-15*60*1000).toISOString()}`),
        )).returning({id:chatAttachments.id});
    if (!claimed) return;
    const ownsClaim = and(eq(chatAttachments.id,attachment.id),eq(chatAttachments.status,"processing"),eq(chatAttachments.lockedAt,startedAt))!;

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
        await adminDb.batch([
            unchangedRow(adminDb,chatAttachments,ownsClaim),
            adminDb.delete(chatAttachmentChunks).where(eq(chatAttachmentChunks.attachmentId,attachment.id)),
            ...chunks.map((content,ordinal)=>adminDb.insert(chatAttachmentChunks).values({attachmentId:attachment.id,content,metadata:{extractor:extracted.extractor},ordinal})),
            adminDb.update(chatAttachments).set({extractionMetadata:{characters:extracted.text.length,chunks:chunks.length,extractor:extracted.extractor},
                lockedAt:null,processedAt:new Date(),status:"ready",updatedAt:new Date()}).where(ownsClaim),
        ]);
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
			.where(ownsClaim);
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
    await adminDb.batch([
        adminDb.delete(chatAttachmentChunks).where(eq(chatAttachmentChunks.attachmentId,attachment.id)),
        adminDb.update(chatAttachments).set({deletedAt:new Date(),driveFullPath:null,drivePath:null,status:"deleted",lockedAt:null,updatedAt:new Date()}).where(eq(chatAttachments.id,attachment.id)),
    ]);
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
		.select({ count: sql<number>`count(*)` })
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

export async function getChatAttachmentContext(conversationId: string, attachmentIds: string[]) {
	// Read each file separately so one large upload cannot consume every excerpt.
	const files = await Promise.all(attachmentIds.slice(0, 5).map(async (attachmentId) => {
		const rows = await adminDb
			.select({ content: chatAttachmentChunks.content, fileName: chatAttachments.fileName })
			.from(chatAttachmentChunks)
			.innerJoin(chatAttachments, eq(chatAttachments.id, chatAttachmentChunks.attachmentId))
			.where(and(
				eq(chatAttachments.conversationId, conversationId),
				eq(chatAttachments.id, attachmentId),
				eq(chatAttachments.status, "ready"),
			))
			.orderBy(chatAttachmentChunks.ordinal)
			.limit(4);
		return rows.length ? {
			attachmentId,
			fileName: rows[0]!.fileName,
			excerpt: rows.map((row) => row.content).join("\n").slice(0, 4_000),
		} : null;
	}));
	return files.filter((file) => file !== null);
}

function orTextSearch(query: string) {
    const tokens = query.match(/[\p{L}\p{N}_]+/gu) ?? [];
    if (tokens.length > 1) {
        const match = tokens.map(token=>`"${token.replaceAll('"','""')}"`).join(" AND ");
        return sql`${chatAttachmentChunks.id} in (select c.id from chat_attachment_chunks c join chat_attachment_chunks_fts f on f.rowid=c.rowid where chat_attachment_chunks_fts match ${match})`;
    }
    return containsInsensitive(chatAttachmentChunks.content, query);
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
			headers: { "X-Tuturuuu-Operation": "attachment-extraction" },
			maxOutputTokens: 8192,
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
