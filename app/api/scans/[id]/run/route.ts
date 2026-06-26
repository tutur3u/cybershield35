import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { getScanDetail, listScans, processScanJobNow } from "@/lib/workers/scans";

export const runtime = "nodejs";

export async function POST(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	const { id } = await context.params;

	try {
		const result = await processScanJobNow(id);
		const detail = await getScanDetail(id);
		if (!detail) return Response.json({ error: "Scan not found" }, { status: 404 });

		const scan = (await listScans()).find((item) => item.id === id) ?? null;
		if (!result.processed) {
			return Response.json(
				{
					detail,
					error: "Scan is not ready to run manually",
					mode: "live",
					processed: false,
					scan,
				},
				{ status: 409, headers: authHeaders(auth) },
			);
		}

		return Response.json(
			{ detail, mode: "live", processed: true, result, scan },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to run scan manually",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
