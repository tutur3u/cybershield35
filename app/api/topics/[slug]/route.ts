import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { getTopicDetailPage } from "@/lib/workers/topics";

export async function GET(
	request: Request,
	context: { params: Promise<{ slug: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	const { slug } = await context.params;
	const searchParams = new URL(request.url).searchParams;
	const cursor = searchParams.get("cursor");
	const limit = Number(searchParams.get("limit") ?? "25");

	try {
		const topic = await getTopicDetailPage({ cursor, limit, slug });
		if (!topic) {
			return Response.json(
				{ error: "Topic not found" },
				{ status: 404, headers: authHeaders(auth) },
			);
		}

		return Response.json(
			{ mode: "live", topic },
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Database unavailable",
			},
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}
