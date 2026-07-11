import { ZodError } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { getTimelineHead } from "@/lib/dashboard/timeline-server";
import { parseTimelineSearchParams } from "@/lib/dashboard/timeline-query";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const { filters } = parseTimelineSearchParams(new URL(request.url).searchParams);
		return Response.json(await getTimelineHead(filters), { headers: authHeaders(auth) });
	} catch (error) {
		return Response.json(
			{ error: error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Không thể kiểm tra cập nhật." },
			{ headers: authHeaders(auth), status: error instanceof ZodError ? 400 : 503 },
		);
	}
}
