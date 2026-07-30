import { eq } from "drizzle-orm";
import { z } from "zod";

import { articleWorkspaceSettingsSchema } from "@/lib/articles/schemas";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { adminDb } from "@/lib/db/client";
import { auditEvents, zaloOaConnections } from "@/lib/db/schema";
import { publicErrorMessage } from "@/lib/http/public-error";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	try {
		const [connection] = await adminDb
			.select({
				autoSyncDrafts: zaloOaConnections.autoSyncDrafts,
				displayName: zaloOaConnections.displayName,
				id: zaloOaConnections.id,
			})
			.from(zaloOaConnections)
			.where(eq(zaloOaConnections.isDefault, true))
			.limit(1);
		return Response.json(
			{
				autoSyncDrafts: connection?.autoSyncDrafts ?? true,
				defaultOa: connection
					? { displayName: connection.displayName, id: connection.id }
					: null,
				defaultRemoteStatus: "hidden",
			},
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể tải cài đặt bài viết.") },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}

export async function PATCH(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	try {
		const input = articleWorkspaceSettingsSchema.parse(await request.json());
		const actor = actorFromAuth(auth);
		const [connection] = await adminDb
			.update(zaloOaConnections)
			.set({
				autoSyncDrafts: input.autoSyncDrafts,
				updatedAt: new Date(),
				updatedByDisplayName: actor.displayName,
				updatedByUserId: actor.id,
			})
			.where(eq(zaloOaConnections.isDefault, true))
			.returning({
				autoSyncDrafts: zaloOaConnections.autoSyncDrafts,
				displayName: zaloOaConnections.displayName,
				id: zaloOaConnections.id,
			});
		if (!connection) {
			return Response.json(
				{ error: "Hãy kết nối và chọn Zalo OA mặc định trước." },
				{ status: 409, headers: authHeaders(auth) },
			);
		}
		await adminDb.insert(auditEvents).values({
			action: "article_workspace_settings_updated",
			entityId: connection.id,
			entityType: "zalo_oa_connection",
			payload: { actorId: actor.id, autoSyncDrafts: input.autoSyncDrafts },
		});
		return Response.json(
			{
				autoSyncDrafts: connection.autoSyncDrafts,
				defaultOa: {
					displayName: connection.displayName,
					id: connection.id,
				},
				defaultRemoteStatus: "hidden",
			},
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{ error: "Cài đặt bài viết không hợp lệ." },
				{ status: 400, headers: authHeaders(auth) },
			);
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể lưu cài đặt bài viết.") },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
