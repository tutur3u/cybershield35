import { ZodError } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { listTimeline } from "@/lib/dashboard/timeline-server";
import { parseTimelineSearchParams } from "@/lib/dashboard/timeline-query";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const parsed = parseTimelineSearchParams(new URL(request.url).searchParams);
		const page = await listTimeline(parsed);
		return Response.json({ ...page, mode: "live" }, { headers: authHeaders(auth) });
	} catch (error) {
		return Response.json(
			{ error: errorMessage(error, "Không thể tải dòng thời gian.") },
			{ headers: authHeaders(auth), status: error instanceof ZodError ? 400 : 503 },
		);
	}
}

function errorMessage(error: unknown, fallback: string) {
	if (error instanceof ZodError) return error.issues[0]?.message ?? "Tham số không hợp lệ.";
	return error instanceof Error ? error.message : fallback;
}
