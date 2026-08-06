import { after } from "next/server";

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
 * Reading is a single indexed lookup and always fast. Producing one takes tens
 * of seconds, so it never happens inside this request — the first reader used
 * to wait for it and the request often died first, which the panel rendered as
 * a skeleton that disappeared.
 *
 * When there is nothing stored, the work is claimed and handed to `after()`,
 * which runs it once the response has already gone out. The caller is told
 * `generating` and polls.
 */
export const maxDuration = 300;

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

		if (read.status === "generating") {
			const range =
				filters.timeRange === "7d" ||
				filters.timeRange === "90d" ||
				filters.timeRange === "all"
					? filters.timeRange
					: "30d";
			// Only the reader that wins the claim generates; the rest just poll, so
			// twenty people opening the page do not start twenty runs.
			if (await claimSummaryGeneration(range)) {
				after(async () => {
					await regenerateIntelligenceSummary(range).catch(() => null);
				});
			}
		}

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
