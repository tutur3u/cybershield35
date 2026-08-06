import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { parseIntelligenceFilters } from "@/app/api/intelligence/_shared";
import {
	claimSummaryGeneration,
	readIntelligenceSummary,
	regenerateIntelligenceSummary,
} from "@/lib/dashboard/intelligence-summary";

/**
 * The written read of the window.
 *
 * GET is a single indexed lookup and always fast. POST produces one, and takes
 * tens of seconds — which is why the two are separate verbs rather than one
 * request that sometimes does both. A reader used to be made to generate, and
 * the request often died before it answered; the panel rendered that as a
 * skeleton that disappeared.
 *
 * Generation was briefly handed to `after()` instead. It did not finish: the
 * claim was taken and the row never appeared, so the work is done in a request
 * of its own where the budget is explicit and the outcome is observable.
 */
export const maxDuration = 300;

function rangeFrom(timeRange: string | undefined) {
	return timeRange === "7d" || timeRange === "90d" || timeRange === "all"
		? timeRange
		: "30d";
}

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const { filters } = parseIntelligenceFilters(
			new URL(request.url).searchParams,
		);
		const read = await readIntelligenceSummary(filters);
		return Response.json(
			{ status: read.status, summary: read.summary },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Không thể tải tóm tắt xu hướng.",
			},
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}

/**
 * Produces the summary for a window, if nobody else already is.
 *
 * Called by the client the first time it sees `generating`. The claim means
 * twenty people opening the page start one run rather than twenty, and it
 * expires, so an abandoned attempt cannot hold the slot for ever.
 */
export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const { filters } = parseIntelligenceFilters(
			new URL(request.url).searchParams,
		);
		const range = rangeFrom(filters.timeRange);
		if (!(await claimSummaryGeneration(range))) {
			// Somebody else is already producing it; the caller keeps polling GET.
			return Response.json(
				{ claimed: false, status: "generating" },
				{ headers: authHeaders(auth) },
			);
		}

		const summary = await regenerateIntelligenceSummary(range);
		return Response.json(
			{ claimed: true, status: summary ? "ready" : "unavailable", summary },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Không thể tạo tóm tắt xu hướng.",
			},
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}
