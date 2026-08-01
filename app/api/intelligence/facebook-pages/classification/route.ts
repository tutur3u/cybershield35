import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardIntelligence } from "@/lib/dashboard/cache-invalidation";
import { updateFacebookPagePolicy } from "@/lib/workers/facebook-page-jobs";

const bodySchema = z
	.object({
		autoDraftEnabled: z.boolean().default(true),
		classification: z.enum(["uncategorized", "trusted", "neutral", "at_risk"]),
		displayName: z.string().trim().min(1).max(200),
		facebookPageId: z.string().trim().min(1).max(200).nullable(),
		pageKey: z
			.string()
			.trim()
			.min(3)
			.max(240)
			.regex(/^(id|username):[^/\\]+$/u),
		username: z.string().trim().min(1).max(100).nullable(),
	})
	.strict();

export async function PATCH(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const body = bodySchema.parse(await request.json());
		const result = await updateFacebookPagePolicy({
			...body,
			autoDraftEnabled:
				body.classification === "uncategorized"
					? false
					: body.autoDraftEnabled,
			actor: {
				displayName: auth.session.user.displayName ?? null,
				id: auth.session.user.id,
			},
		});
		revalidateDashboardIntelligence("facebook-pages");
		revalidateDashboardIntelligence("timeline");
		return Response.json(
			{
				enqueued: result.enqueued,
				profile: {
					autoDraftEnabled: result.profile.autoDraftEnabled,
					classification: result.profile.classification,
					pageKey: result.profile.pageKey,
					updatedAt: result.profile.updatedAt.toISOString(),
				},
			},
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{ error: "Phân loại fanpage không hợp lệ.", details: z.treeifyError(error) },
				{ status: 400, headers: authHeaders(auth) },
			);
		}
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Không thể cập nhật phân loại fanpage.",
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
