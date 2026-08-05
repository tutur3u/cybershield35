import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { getWorkflowPipeline } from "@/lib/dashboard/pipeline-server";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const pipeline = await getWorkflowPipeline();
		return Response.json({ pipeline }, { headers: authHeaders(auth) });
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Không thể tải trạng thái quy trình.",
			},
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}
