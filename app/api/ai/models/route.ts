import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { getAllowedAiModels } from "@/lib/llm/generation";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	const models = getAllowedAiModels();
	return Response.json(
		{
			defaultModel: process.env.TUTURUUU_AI_MODEL?.trim() || models[0],
			models,
			provider: "tuturuuu",
		},
		{ headers: authHeaders(auth) },
	);
}
