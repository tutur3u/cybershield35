import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { getDashboardInitialData } from "@/lib/dashboard/server-data";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	const searchParams = new URL(request.url).searchParams;
	const includeScans = searchParams.get("includeScans") !== "false";
	const includeDetail = searchParams.get("includeDetail") !== "false";
	const includeTrackedSources = searchParams.get("includeTrackedSources") === "true";
	const scanId = searchParams.get("scanId") || null;

	if (!includeScans) {
		return Response.json(
			{
				detail: null,
				scans: [],
				selectedScanId: scanId ?? "",
				trackedSources: [],
			},
			{ headers: authHeaders(auth) },
		);
	}

	const data = await getDashboardInitialData(
		scanId,
		includeDetail,
		includeTrackedSources,
	);

	return Response.json(data, { headers: authHeaders(auth) });
}
