import "server-only";

const DEFAULT_AI_STUDIO_URL = "https://ai.tuturuuu.com";
const AI_STUDIO_DEFAULT_CURRENCY = "VND";

/**
 * Deep links into this workspace on the Tuturuuu AI Studio.
 *
 * Every CS35 AI call is metered against one Tuturuuu workspace, but the numbers
 * live on the AI Studio rather than here. Without a link an operator has to know
 * the studio exists, find it, and then pick the right workspace out of a list —
 * so in practice nobody checks what the AI is costing.
 *
 * Built server-side because the workspace id is private configuration. It is not
 * a secret — it sits in the URL bar once you are there — but it has no reason to
 * be in the client bundle for every visitor.
 */
export function aiStudioWorkspaceUrl(path: "credits" | "usage" | "runs") {
	const workspaceId = process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID?.trim();
	if (!workspaceId) return null;

	const base = (
		process.env.TUTURUUU_AI_APP_URL?.trim() || DEFAULT_AI_STUDIO_URL
	).replace(/\/+$/u, "");

	try {
		// Validated rather than concatenated, so a malformed override surfaces as a
		// missing link instead of a broken one.
		const url = new URL(`${base}/${encodeURIComponent(workspaceId)}/${path}`);
		// The team reads costs in đồng. The studio still offers its own currency
		// switcher, so this sets the starting point rather than pinning it.
		url.searchParams.set("currency", AI_STUDIO_DEFAULT_CURRENCY);
		return url.toString();
	} catch {
		return null;
	}
}
