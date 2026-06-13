import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { demoDraft } from "@/lib/domain/fixtures";
import { generateDraftForScan } from "@/lib/workers/scans";

export const runtime = "nodejs";

const bodySchema = z.object({
	tone: z.string().min(1).default("Điềm tĩnh, khách quan"),
	audience: z.string().min(1).default("Công chúng chung"),
	language: z.string().min(2).default("vi"),
	length: z.string().min(1).default("medium"),
	operatorNotes: z.string().optional(),
});

export async function POST(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	const { id } = await context.params;
	const body = bodySchema.parse(await request.json());

	if (id.startsWith("demo")) {
		return Response.json(
			{ draft: demoDraft, mode: "demo" },
			{ status: 201, headers: authHeaders(auth) },
		);
	}

	try {
		const draft = await generateDraftForScan(id, body);
		return Response.json(
			{ draft, mode: "live" },
			{ status: 201, headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				draft: demoDraft,
				mode: "demo",
				warning: error instanceof Error ? error.message : "Draft fallback used",
			},
			{ status: 201, headers: authHeaders(auth) },
		);
	}
}
