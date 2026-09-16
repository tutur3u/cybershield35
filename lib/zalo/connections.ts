import { unchangedRow } from "@/lib/db/d1-guard";
import "server-only";

import { and, eq, sql } from "drizzle-orm";

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
    const [existing] = await adminDb.select({id:zaloOaConnections.id}).from(zaloOaConnections).where(eq(zaloOaConnections.oaId,profile.oaId)).limit(1);
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
    const [[connection]] = await adminDb.batch([
        adminDb.insert(zaloOaConnections).values({...values,
            connectedByDisplayName:actor.displayName,connectedByUserId:actor.id,
            isDefault:sql`not exists(select 1 from zalo_oa_connections)`,
        }).onConflictDoUpdate({target:zaloOaConnections.oaId,set:values}).returning(),
        adminDb.insert(auditEvents).values({action:existing ? "zalo_oa_reconnected" : "zalo_oa_connected",
            entityId:sql`(select id from zalo_oa_connections where oa_id=${profile.oaId})`,
            entityType:"zalo_oa_connection",payload:{actorId:actor.id,oaId:profile.oaId}}),
    ]);
    if (!connection) throw new Error("Không thể lưu kết nối Zalo OA.");
    return toSafeConnection(connection);
}

export async function setDefaultZaloConnection(id: string, actor: ChatActor) {
    const [current] = await adminDb.select().from(zaloOaConnections).where(eq(zaloOaConnections.id,id)).limit(1);
    if (!current) return null;
    const [, , [updated]] = await adminDb.batch([
        unchangedRow(adminDb,zaloOaConnections,and(eq(zaloOaConnections.id,id),eq(zaloOaConnections.revision,current.revision))!),
        adminDb.update(zaloOaConnections).set({isDefault:false}),
        adminDb.update(zaloOaConnections).set({isDefault:true,updatedAt:new Date(),updatedByDisplayName:actor.displayName,updatedByUserId:actor.id}).where(eq(zaloOaConnections.id,id)).returning(),
        adminDb.insert(auditEvents).values({action:"zalo_oa_default_changed",entityId:id,entityType:"zalo_oa_connection",payload:{actorId:actor.id}}),
    ]);
    return updated ? toSafeConnection(updated) : null;
}

export async function disconnectZaloConnection(id: string, actor: ChatActor) {
    const [connection] = await adminDb.select().from(zaloOaConnections).where(eq(zaloOaConnections.id,id)).limit(1);
    if (!connection) return null;
    await adminDb.batch([
        unchangedRow(adminDb,zaloOaConnections,and(eq(zaloOaConnections.id,id),eq(zaloOaConnections.revision,connection.revision))!),
        adminDb.delete(zaloOaConnections).where(eq(zaloOaConnections.id,id)),
        ...(connection.isDefault ? [adminDb.update(zaloOaConnections).set({isDefault:true})
            .where(sql`${zaloOaConnections.id} = (select id from zalo_oa_connections order by id limit 1)`)] : []),
        adminDb.insert(auditEvents).values({action:"zalo_oa_disconnected",entityId:id,entityType:"zalo_oa_connection",payload:{actorId:actor.id,oaId:connection.oaId}}),
    ]);
    return toSafeConnection(connection);
}

export async function getValidZaloAccessToken(connectionId: string) {
    for (let attempt = 0; attempt < 30; attempt++) {
        const [connection] = await adminDb.select().from(zaloOaConnections).where(eq(zaloOaConnections.id,connectionId)).limit(1);
        if (!connection) throw new Error("Kết nối Zalo OA không còn khả dụng.");
        if (connection.status === "refreshing") {
            if (Date.now() - connection.updatedAt.getTime() > 120000) throw new Error("Làm mới Zalo bị gián đoạn. Vui lòng kết nối lại.");
            await new Promise(resolve => setTimeout(resolve,500));
            continue;
        }
        if (connection.status !== "connected") throw new Error("Kết nối Zalo OA không còn khả dụng.");
        if (connection.accessTokenExpiresAt.getTime() > Date.now()+REFRESH_SKEW_MS) return decryptZaloSecret(connection.accessTokenEncrypted);
        if(process.env.CS35_DEPLOYMENT_MODE === "staging") throw new Error("Bản kiểm thử không làm mới kết nối Zalo đang dùng trong production.");
        if (connection.refreshTokenExpiresAt.getTime() <= Date.now()) throw new Error("Ủy quyền Zalo OA đã hết hạn. Vui lòng kết nối lại.");
        const claimed = await adminDb.update(zaloOaConnections).set({status:"refreshing",updatedAt:new Date()})
            .where(and(eq(zaloOaConnections.id,connectionId),eq(zaloOaConnections.revision,connection.revision),eq(zaloOaConnections.status,"connected"))).returning({id:zaloOaConnections.id});
        if (!claimed.length) continue;
        const ownsRefresh = and(eq(zaloOaConnections.id,connectionId),eq(zaloOaConnections.status,"refreshing"),eq(zaloOaConnections.revision,connection.revision+1))!;
		try {
			const tokens = await refreshZaloToken(
				decryptZaloSecret(connection.refreshTokenEncrypted),
			);
			const now = new Date();
			const saved = await adminDb
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
				.where(ownsRefresh).returning({id:zaloOaConnections.id});
            if (!saved.length) throw new Error("Kết nối Zalo đã thay đổi trong khi làm mới.");
			return tokens.accessToken;
		} catch (error) {
			await adminDb
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
				.where(ownsRefresh);
			throw error;
		}
    }
    throw new Error("Đang làm mới kết nối Zalo. Vui lòng thử lại.");
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
