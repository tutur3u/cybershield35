import { eq } from "drizzle-orm";
import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardIntelligence, revalidateDashboardScan } from "@/lib/dashboard/cache-invalidation";
import { adminDb } from "@/lib/db/client";
import { evidenceItems } from "@/lib/db/schema";
import {
	DEFAULT_DRAFT_TONE,
	DEFAULT_DRAFT_VOICE,
} from "@/lib/domain/draft-style";
import { generateDraftForScan } from "@/lib/workers/scans";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z
	.object({
		audience: z.string().trim().min(1).max(120).default("Công chúng chung"),
		draftKind: z.enum(["response", "comment", "counter_argument", "internal_brief"]),
		includeRelatedEvidence: z.boolean().default(false),
		language: z.string().trim().min(2).max(40).default("vi"),
		length: z.string().trim().min(1).max(40).default("medium"),
		operatorNotes: z.string().trim().max(2000).optional(),
		tone: z.string().trim().min(1).max(120).default(DEFAULT_DRAFT_TONE),
		voice: z.string().trim().min(1).max(120).default(DEFAULT_DRAFT_VOICE),
	})
	.strict();

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const { id } = paramsSchema.parse(await params);
		const input = bodySchema.parse(await request.json());
		const [evidence] = await adminDb
			.select({ scanJobId: evidenceItems.scanJobId })
			.from(evidenceItems)
			.where(eq(evidenceItems.id, id))
			.limit(1);
		if (!evidence) return Response.json({ error: "Bằng chứng không tồn tại." }, { status: 404 });
		const draft = await generateDraftForScan(evidence.scanJobId, {
			...input,
			actor: {
				displayName: auth.session.user.displayName ?? null,
				id: auth.session.user.id,
			},
			evidenceId: id,
			session: auth.session,
		});
		revalidateDashboardScan(evidence.scanJobId);
		revalidateDashboardIntelligence("activity");
		return Response.json(
			{ draft, href: `/drafts/${draft.id}?scanId=${evidence.scanJobId}` },
			{ status: 201, headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		return Response.json(
			{ error: error instanceof Error ? error.message : "Không thể tạo bản nháp." },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
