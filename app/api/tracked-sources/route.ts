import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardTrackedSources } from "@/lib/dashboard/cache-invalidation";
import {
	createTrackedSource,
	listTrackedSources,
} from "@/lib/workers/tracked-sources";

const bodySchema = z.object({
	url: z.string().min(1),
	displayName: z.string().optional(),
});

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const sources = await listTrackedSources();
		return Response.json(
			{ trackedSources: sources, mode: "live" },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error ? error.message : "Tracked sources unavailable",
			},
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}

export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const body = bodySchema.parse(await request.json());
		const source = await createTrackedSource(body);
		revalidateDashboardTrackedSources();
		return Response.json(
			{ trackedSource: source, mode: "live" },
			{ status: 201, headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}

		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to create tracked source",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
