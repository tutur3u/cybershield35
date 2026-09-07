import "server-only";
import { getTuturuuuMachineToken } from "@/lib/tuturuuu/machine-credential";
import { aiUsageSchema, type AiUsage } from "./ai-usage";

export async function readAiUsage(
	workspace: string,
	accessToken?: string,
): Promise<{
	status: "ready" | "unavailable" | "unconfigured";
	data: AiUsage | null;
}> {
	const token = getTuturuuuMachineToken() ?? accessToken;
	if (!token || !workspace) return { status: "unconfigured", data: null };
	try {
		const base = (
			process.env.TUTURUUU_AI_MACHINE_BASE_URL?.trim() ||
			"https://ai.tuturuuu.com/v1"
		).replace(/\/$/, "");
		const response = await fetch(`${base}/usage`, {
			headers: {
				Authorization: `Bearer ${token}`,
				"x-tuturuuu-workspace-id": workspace,
			},
			cache: "no-store",
			signal: AbortSignal.timeout(20_000),
		});
		if (!response.ok) return { status: "unavailable", data: null };
		const parsed = aiUsageSchema.safeParse(await response.json());
		if (
			!parsed.success ||
			parsed.data.workspaceId.toLowerCase() !== workspace.toLowerCase()
		)
			return { status: "unavailable", data: null };
		return { status: "ready", data: parsed.data };
	} catch {
		return { status: "unavailable", data: null };
	}
}
