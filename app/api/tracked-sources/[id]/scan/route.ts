import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import {
	parseClientRuntime,
	redactRuntimeSecrets,
} from "@/lib/runtime/client-runtime";
import { scanTrackedSource } from "@/lib/workers/tracked-sources";

export const runtime = "nodejs";

export async function POST(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	const body = await request.json().catch(() => ({}));
	const requestRuntime = parseClientRuntime(body.clientRuntime);

	try {
		const { id } = await context.params;
		const result = await scanTrackedSource(id, requestRuntime);
		if (!result) {
			return Response.json({ error: "Tracked source not found" }, { status: 404 });
		}

		return Response.json(
			{
				trackedSource: result.source,
				scan: result.scan,
				mode: "live",
			},
			{ status: 201, headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? redactRuntimeSecrets(error.message, requestRuntime)
						: "Failed to scan tracked source",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
