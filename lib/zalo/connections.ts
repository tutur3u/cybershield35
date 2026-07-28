import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";

import type { ChatActor } from "@/lib/chat/types";
import { adminDb } from "@/lib/db/client";
import { auditEvents, zaloOaConnections } from "@/lib/db/schema";
import { publicErrorMessage } from "@/lib/http/public-error";

import { refreshZaloToken, type ZaloTokenResponse } from "./client";
import { decryptZaloSecret, encryptZaloSecret } from "./crypto";

const REFRESH_SKEW_MS = 5 * 60 * 1000;

export async function listSafeZaloConnections() {
	const rows = await adminDb
		.select()
		.from(zaloOaConnections)
		.orderBy(zaloOaConnections.displayName);
	return rows.map(toSafeConnection);
}

export async function upsertZaloConnection(
	profile: { avatarUrl: string | null; displayName: string; oaId: string },
	tokens: ZaloTokenResponse,
	actor: ChatActor,
) {
	return adminDb.transaction(async (tx) => {
		const [existing] = await tx
			.select({ id: zaloOaConnections.id })
			.from(zaloOaConnections)
			.where(eq(zaloOaConnections.oaId, profile.oaId))
			.limit(1);
		const [connectionCount] = await tx
			.select({ value: sql<number>`count(*)::int` })
			.from(zaloOaConnections);
		const now = new Date();
		const values = {
			accessTokenEncrypted: encryptZaloSecret(tokens.accessToken),
			accessTokenExpiresAt: new Date(
				now.getTime() + tokens.accessTokenExpiresIn * 1000,
			),
			avatarUrl: profile.avatarUrl,
			displayName: profile.displayName,
			lastError: null,
			lastRefreshedAt: now,
			oaId: profile.oaId,
			refreshTokenEncrypted: encryptZaloSecret(tokens.refreshToken),
			refreshTokenExpiresAt: new Date(
				now.getTime() + tokens.refreshTokenExpiresIn * 1000,
			),
			status: "connected",
			updatedAt: now,
			updatedByDisplayName: actor.displayName,
			updatedByUserId: actor.id,
		};
		const [connection] = existing
			? await tx
					.update(zaloOaConnections)
					.set(values)
					.where(eq(zaloOaConnections.id, existing.id))
					.returning()
			: await tx
					.insert(zaloOaConnections)
					.values({
						...values,
						connectedByDisplayName: actor.displayName,
						connectedByUserId: actor.id,
						isDefault: (connectionCount?.value ?? 0) === 0,
					})
					.returning();
		if (!connection) throw new Error("Không thể lưu kết nối Zalo OA.");
		await tx.insert(auditEvents).values({
			action: existing ? "zalo_oa_reconnected" : "zalo_oa_connected",
			entityId: connection.id,
			entityType: "zalo_oa_connection",
			payload: { actorId: actor.id, oaId: profile.oaId },
		});
		return toSafeConnection(connection);
	});
}

export async function setDefaultZaloConnection(id: string, actor: ChatActor) {
	return adminDb.transaction(async (tx) => {
		await tx.update(zaloOaConnections).set({ isDefault: false });
		const [updated] = await tx
			.update(zaloOaConnections)
			.set({
				isDefault: true,
				updatedAt: new Date(),
				updatedByDisplayName: actor.displayName,
				updatedByUserId: actor.id,
			})
			.where(eq(zaloOaConnections.id, id))
			.returning();
		if (updated) {
			await tx.insert(auditEvents).values({
				action: "zalo_oa_default_changed",
				entityId: id,
				entityType: "zalo_oa_connection",
				payload: { actorId: actor.id },
			});
		}
		return updated ? toSafeConnection(updated) : null;
	});
}

export async function disconnectZaloConnection(id: string, actor: ChatActor) {
	return adminDb.transaction(async (tx) => {
		const [connection] = await tx
			.delete(zaloOaConnections)
			.where(eq(zaloOaConnections.id, id))
			.returning();
		if (!connection) return null;
		if (connection.isDefault) {
			const [next] = await tx
				.select({ id: zaloOaConnections.id })
				.from(zaloOaConnections)
				.where(ne(zaloOaConnections.id, id))
				.limit(1);
			if (next) {
				await tx
					.update(zaloOaConnections)
					.set({ isDefault: true })
					.where(eq(zaloOaConnections.id, next.id));
			}
		}
		await tx.insert(auditEvents).values({
			action: "zalo_oa_disconnected",
			entityId: connection.id,
			entityType: "zalo_oa_connection",
			payload: { actorId: actor.id, oaId: connection.oaId },
		});
		return toSafeConnection(connection);
	});
}

export async function getValidZaloAccessToken(connectionId: string) {
	return adminDb.transaction(async (tx) => {
		await tx.execute(
			sql`select id from zalo_oa_connections where id = ${connectionId} for update`,
		);
		const [connection] = await tx
			.select()
			.from(zaloOaConnections)
			.where(
				and(
					eq(zaloOaConnections.id, connectionId),
					eq(zaloOaConnections.status, "connected"),
				),
			)
			.limit(1);
		if (!connection) throw new Error("Kết nối Zalo OA không còn khả dụng.");
		if (
			connection.accessTokenExpiresAt.getTime() >
			Date.now() + REFRESH_SKEW_MS
		) {
			return decryptZaloSecret(connection.accessTokenEncrypted);
		}
		if (connection.refreshTokenExpiresAt.getTime() <= Date.now()) {
			await tx
				.update(zaloOaConnections)
				.set({
					lastError: "Ủy quyền đã hết hạn. Vui lòng kết nối lại.",
					status: "reauthorization_required",
					updatedAt: new Date(),
				})
				.where(eq(zaloOaConnections.id, connectionId));
			throw new Error("Ủy quyền Zalo OA đã hết hạn. Vui lòng kết nối lại.");
		}
		try {
			const tokens = await refreshZaloToken(
				decryptZaloSecret(connection.refreshTokenEncrypted),
			);
			const now = new Date();
			await tx
				.update(zaloOaConnections)
				.set({
					accessTokenEncrypted: encryptZaloSecret(tokens.accessToken),
					accessTokenExpiresAt: new Date(
						now.getTime() + tokens.accessTokenExpiresIn * 1000,
					),
					lastError: null,
					lastRefreshedAt: now,
					refreshTokenEncrypted: encryptZaloSecret(tokens.refreshToken),
					refreshTokenExpiresAt: new Date(
						now.getTime() + tokens.refreshTokenExpiresIn * 1000,
					),
					status: "connected",
					updatedAt: now,
				})
				.where(eq(zaloOaConnections.id, connectionId));
			return tokens.accessToken;
		} catch (error) {
			await tx
				.update(zaloOaConnections)
				.set({
					lastError:
						publicErrorMessage(
							error,
							"Không thể làm mới quyền truy cập Zalo. Vui lòng kết nối lại.",
						),
					status: "reauthorization_required",
					updatedAt: new Date(),
				})
				.where(eq(zaloOaConnections.id, connectionId));
			throw error;
		}
	});
}

function toSafeConnection(
	connection: typeof zaloOaConnections.$inferSelect,
) {
	return {
		accessTokenExpiresAt: connection.accessTokenExpiresAt.toISOString(),
		avatarUrl: connection.avatarUrl,
		displayName: connection.displayName,
		id: connection.id,
		isDefault: connection.isDefault,
		lastError: connection.lastError,
		lastRefreshedAt: connection.lastRefreshedAt?.toISOString() ?? null,
		oaId: connection.oaId,
		refreshTokenExpiresAt: connection.refreshTokenExpiresAt.toISOString(),
		status: connection.status,
		updatedAt: connection.updatedAt.toISOString(),
	};
}
