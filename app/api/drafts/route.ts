import { and, desc, eq, ilike, lt, or } from "drizzle-orm";
import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { adminDb } from "@/lib/db/client";
import { counterArgumentDrafts, evidenceItems } from "@/lib/db/schema";

const querySchema = z.object({
	cursor: z.string().min(1).max(500).optional(),
	evidenceId: z.string().uuid().optional(),
	kind: z.enum(["response", "comment", "counter_argument", "internal_brief"]).optional(),
	limit: z.coerce.number().int().min(1).max(50).default(24),
	q: z.string().trim().max(200).optional(),
	status: z.enum(["draft", "needs_review", "approved", "rejected"]).optional(),
});
const cursorSchema = z.object({ createdAt: z.string().datetime({ offset: true }), id: z.string().uuid() });

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const input = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
		const cursor = input.cursor ? decodeCursor(input.cursor) : null;
		const rows = await adminDb
			.select({
				audience: counterArgumentDrafts.audience,
				body: counterArgumentDrafts.body,
				createdAt: counterArgumentDrafts.createdAt,
				createdByDisplayName: counterArgumentDrafts.createdByDisplayName,
				draftKind: counterArgumentDrafts.draftKind,
				evidenceItemId: counterArgumentDrafts.evidenceItemId,
				id: counterArgumentDrafts.id,
				generationReason: counterArgumentDrafts.generationReason,
				language: counterArgumentDrafts.language,
				scanJobId: counterArgumentDrafts.scanJobId,
				status: counterArgumentDrafts.status,
				tone: counterArgumentDrafts.tone,
				voice: counterArgumentDrafts.voice,
				updatedAt: counterArgumentDrafts.updatedAt,
				evidenceQuote: evidenceItems.quote,
			})
			.from(counterArgumentDrafts)
			.leftJoin(evidenceItems, eq(evidenceItems.id, counterArgumentDrafts.evidenceItemId))
			.where(
				and(
					input.kind ? eq(counterArgumentDrafts.draftKind, input.kind) : undefined,
					input.status ? eq(counterArgumentDrafts.status, input.status) : undefined,
					input.evidenceId ? eq(counterArgumentDrafts.evidenceItemId, input.evidenceId) : undefined,
					input.q ? or(ilike(counterArgumentDrafts.body, `%${input.q}%`), ilike(evidenceItems.quote, `%${input.q}%`)) : undefined,
					cursor
						? or(
								lt(counterArgumentDrafts.createdAt, new Date(cursor.createdAt)),
								and(
									eq(counterArgumentDrafts.createdAt, new Date(cursor.createdAt)),
									lt(counterArgumentDrafts.id, cursor.id),
								),
							)
						: undefined,
				),
			)
			.orderBy(desc(counterArgumentDrafts.createdAt), desc(counterArgumentDrafts.id))
			.limit(input.limit + 1);
		const items = rows.slice(0, input.limit);
		return Response.json(
			{
				hasNextPage: rows.length > input.limit,
				items,
				nextCursor: rows.length > input.limit && items.at(-1)
					? encodeCursor({ createdAt: items.at(-1)!.createdAt.toISOString(), id: items.at(-1)!.id })
					: null,
			},
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		return Response.json({ error: "Không thể tải bản nháp." }, { status: 500 });
	}
}

function encodeCursor(value: z.infer<typeof cursorSchema>) {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor(value: string) {
	try {
		return cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
	} catch {
		throw new z.ZodError([{ code: "custom", message: "Cursor không hợp lệ.", path: ["cursor"] }]);
	}
}
