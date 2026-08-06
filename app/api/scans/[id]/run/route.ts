import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import {
	revalidateDashboardScan,
	revalidateDashboardTrackedSources,
} from "@/lib/dashboard/cache-invalidation";
import { toClientScanDetail } from "@/lib/dashboard/detail-projection";
import {
	forceRetryScan,
	getScanDetail,
	listScans,
	processScanJobNow,
} from "@/lib/workers/scans";

export async function POST(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	const { id } = await context.params;
	/*
	 * `?force=1` re-queues a scan that has already spent its retry budget. The
	 * ordinary path refuses those — correctly, since most are terminal — but a
	 * capacity failure is not, and the operator can see the provider recover
	 * before any timer would.
	 */
	const force = new URL(request.url).searchParams.get("force") === "1";

	try {
		const result = force
			? await forceRetryScan(id)
			: await processScanJobNow(id);
		const detail = await getScanDetail(id);
		if (!detail) return Response.json({ error: "Scan not found" }, { status: 404 });
		revalidateDashboardScan(id);
		revalidateDashboardTrackedSources();

		const scan = (await listScans()).find((item) => item.id === id) ?? null;
		if (!result.processed) {
			/*
			 * A deferred scan is queued and waiting for a slot, which is a normal
			 * state and not a refusal — answering 409 made the button report an
			 * error for the one outcome the cap exists to produce.
			 */
			const deferred = "deferred" in result && result.deferred;
			return Response.json(
				{
					deferred,
					detail: toClientScanDetail(detail),
					error: deferred
						? null
						: "Scan is not ready to run manually",
					message: deferred
						? "Đã xếp hàng. Scan sẽ chạy ngay khi có chỗ trống."
						: null,
					mode: "live",
					processed: false,
					scan,
				},
				{ status: deferred ? 202 : 409, headers: authHeaders(auth) },
			);
		}

		return Response.json(
			{
				detail: toClientScanDetail(detail),
				mode: "live",
				processed: true,
				result,
				scan,
			},
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
