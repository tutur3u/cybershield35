import { desc, eq, or } from "drizzle-orm";
import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { adminDb } from "@/lib/db/client";
import { aiPromptPresets, auditEvents } from "@/lib/db/schema";
import { publicErrorMessage } from "@/lib/http/public-error";

const presetSchema = z
	.object({
		description: z.string().trim().max(500).nullable().optional(),
		instructions: z.string().trim().min(1).max(4_000),
		name: z.string().trim().min(1).max(120),
		tone: z.string().trim().max(120).nullable().optional(),
		visibility: z.enum(["private", "workspace"]).default("private"),
		voice: z.string().trim().max(120).nullable().optional(),
	})
	.strict();

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	const rows = await adminDb
		.select()
		.from(aiPromptPresets)
		.where(
			or(
				eq(aiPromptPresets.ownerUserId, auth.session.user.id),
				eq(aiPromptPresets.visibility, "workspace"),
			),
		)
		.orderBy(desc(aiPromptPresets.updatedAt));
	return Response.json({ presets: rows }, { headers: authHeaders(auth) });
}

export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const input = presetSchema.parse(await request.json());
		const actor = actorFromAuth(auth);
		const [preset] = await adminDb
			.insert(aiPromptPresets)
			.values({
				...input,
				ownerDisplayName: actor.displayName,
				ownerUserId: actor.id,
			})
			.returning();
		if (!preset) throw new Error("Không thể lưu preset.");
		await adminDb.insert(auditEvents).values({
			action: "ai_prompt_preset_created",
			entityId: preset.id,
			entityType: "ai_prompt_preset",
			payload: { actorId: actor.id, visibility: preset.visibility },
		});
		return Response.json({ preset }, { status: 201, headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể lưu preset.") },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
