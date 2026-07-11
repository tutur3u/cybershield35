import "server-only";

import { and, desc, eq, isNull, ne, or } from "drizzle-orm";

import { adminDb } from "@/lib/db/client";
import {
	chatAttachments,
	chatConversations,
	chatMessages,
	chatModelRuns,
} from "@/lib/db/schema";

import type { ChatActor, ChatUIMessage } from "./types";

export async function listChatConversations(actorId: string) {
	return adminDb
		.select()
		.from(chatConversations)
		.where(
			and(
				isNull(chatConversations.deletedAt),
				or(
					eq(chatConversations.ownerUserId, actorId),
					eq(chatConversations.visibility, "workspace"),
				),
			),
		)
		.orderBy(desc(chatConversations.updatedAt), desc(chatConversations.id));
}

export async function createChatConversation(
	actor: ChatActor,
	title = "Cuộc trò chuyện mới",
) {
	const [conversation] = await adminDb
		.insert(chatConversations)
		.values({
			ownerDisplayName: actor.displayName,
			ownerUserId: actor.id,
			title,
		})
		.returning();
	if (!conversation) throw new Error("Không thể tạo cuộc trò chuyện.");
	return conversation;
}

export async function getChatConversation(
	conversationId: string,
	actorId: string,
) {
	const [conversation] = await adminDb
		.select()
		.from(chatConversations)
		.where(
			and(
				eq(chatConversations.id, conversationId),
				isNull(chatConversations.deletedAt),
				or(
					eq(chatConversations.ownerUserId, actorId),
					eq(chatConversations.visibility, "workspace"),
				),
			),
		)
		.limit(1);
	if (!conversation) return null;

	const [messageRows, attachmentRows, modelRuns] = await Promise.all([
		adminDb
			.select()
			.from(chatMessages)
			.where(eq(chatMessages.conversationId, conversationId))
			.orderBy(chatMessages.createdAt, chatMessages.id),
		adminDb
			.select()
			.from(chatAttachments)
			.where(
				and(
					eq(chatAttachments.conversationId, conversationId),
					ne(chatAttachments.status, "deleted"),
				),
			)
			.orderBy(chatAttachments.createdAt),
		adminDb
			.select()
			.from(chatModelRuns)
			.where(eq(chatModelRuns.conversationId, conversationId))
			.orderBy(desc(chatModelRuns.startedAt))
			.limit(12),
	]);

	return {
		attachments: attachmentRows,
		conversation,
		messages: messageRows.map(toUIMessage),
		modelRuns,
		readOnly: conversation.ownerUserId !== actorId,
	};
}

export async function requireOwnedChatConversation(
	conversationId: string,
	actorId: string,
) {
	const [conversation] = await adminDb
		.select()
		.from(chatConversations)
		.where(
			and(
				eq(chatConversations.id, conversationId),
				eq(chatConversations.ownerUserId, actorId),
				isNull(chatConversations.deletedAt),
			),
		)
		.limit(1);
	return conversation ?? null;
}

export async function updateChatConversation(
	conversationId: string,
	actorId: string,
	patch: {
		archived?: boolean;
		title?: string;
		visibility?: "private" | "workspace";
	},
) {
	const now = new Date();
	const [conversation] = await adminDb
		.update(chatConversations)
		.set({
			...(patch.archived !== undefined
				? { archivedAt: patch.archived ? now : null }
				: {}),
			...(patch.title ? { title: patch.title } : {}),
			...(patch.visibility
				? {
						sharedAt: patch.visibility === "workspace" ? now : null,
						visibility: patch.visibility,
					}
				: {}),
			updatedAt: now,
		})
		.where(
			and(
				eq(chatConversations.id, conversationId),
				eq(chatConversations.ownerUserId, actorId),
				isNull(chatConversations.deletedAt),
			),
		)
		.returning();
	return conversation ?? null;
}

export async function softDeleteChatConversation(
	conversationId: string,
	actorId: string,
) {
	return adminDb.transaction(async (tx) => {
		const now = new Date();
		const [conversation] = await tx
			.update(chatConversations)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(chatConversations.id, conversationId),
					eq(chatConversations.ownerUserId, actorId),
					isNull(chatConversations.deletedAt),
				),
			)
			.returning();
		if (!conversation) return null;
		await tx
			.update(chatAttachments)
			.set({ deleteRequestedAt: now, status: "deleting", updatedAt: now })
			.where(
				and(
					eq(chatAttachments.conversationId, conversationId),
					ne(chatAttachments.status, "deleted"),
				),
			);
		return conversation;
	});
}

export async function forkChatConversation(
	conversationId: string,
	actor: ChatActor,
) {
	const source = await getChatConversation(conversationId, actor.id);
	if (!source || source.conversation.visibility !== "workspace") return null;

	return adminDb.transaction(async (tx) => {
		const [fork] = await tx
			.insert(chatConversations)
			.values({
				forkedFromId: source.conversation.id,
				lastMessageAt: source.conversation.lastMessageAt,
				ownerDisplayName: actor.displayName,
				ownerUserId: actor.id,
				title: `${source.conversation.title} · Bản sao`,
			})
			.returning();
		if (!fork) throw new Error("Không thể sao chép cuộc trò chuyện.");
		if (source.messages.length > 0) {
			await tx.insert(chatMessages).values(
				source.messages.map((message) => ({
					actorDisplayName: message.role === "user" ? actor.displayName : null,
					actorUserId: message.role === "user" ? actor.id : null,
					conversationId: fork.id,
					metadata: (message.metadata ?? {}) as Record<string, unknown>,
					parts: message.parts,
					role: message.role,
				})),
			);
		}
		return fork;
	});
}

export async function persistChatMessage(
	conversationId: string,
	message: ChatUIMessage,
	actor?: ChatActor,
) {
	const [stored] = await adminDb
		.insert(chatMessages)
		.values({
			actorDisplayName: actor?.displayName,
			actorUserId: actor?.id,
			conversationId,
			id: message.id,
			metadata: (message.metadata ?? {}) as Record<string, unknown>,
			parts: message.parts,
			role: message.role,
		})
		.onConflictDoUpdate({
			set: {
				metadata: (message.metadata ?? {}) as Record<string, unknown>,
				parts: message.parts,
			},
			target: chatMessages.id,
		})
		.returning();

	if (stored) {
		await adminDb
			.update(chatConversations)
			.set({ lastMessageAt: stored.createdAt, updatedAt: stored.createdAt })
			.where(eq(chatConversations.id, conversationId));
	}
	return stored ?? null;
}

function toUIMessage(row: typeof chatMessages.$inferSelect): ChatUIMessage {
	return {
		id: row.id,
		metadata: {
			...row.metadata,
			createdAt: row.createdAt.toISOString(),
		},
		parts: row.parts as ChatUIMessage["parts"],
		role: row.role as ChatUIMessage["role"],
	};
}
