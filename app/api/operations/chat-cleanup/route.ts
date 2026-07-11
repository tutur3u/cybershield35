import { eq } from "drizzle-orm";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { cleanupDeletedConversation } from "@/lib/chat/attachments";
import { revalidateDashboardHealth } from "@/lib/dashboard/cache-invalidation";
import { adminDb } from "@/lib/db/client";
import { chatAttachments } from "@/lib/db/schema";

export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	const rows = await adminDb
		.selectDistinct({ conversationId: chatAttachments.conversationId })
		.from(chatAttachments)
		.where(eq(chatAttachments.status, "deleting"))
		.limit(25);
	let completed = 0;
	for (const row of rows) {
		if (await cleanupDeletedConversation(row.conversationId, auth.session.accessToken)) completed += 1;
	}
	revalidateDashboardHealth();
	return Response.json({ attempted: rows.length, completed }, { headers: authHeaders(auth) });
}
