import { z, ZodError } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardIntelligence } from "@/lib/dashboard/cache-invalidation";
import {
	getEvidenceTriageDetails,
	TimelineNotFoundError,
	updateEvidenceTriage,
} from "@/lib/dashboard/timeline-server";
import { fetchWorkspaceMembersForRequest } from "@/lib/workspace-members/proxy";

const paramsSchema = z.object({ id: z.uuid() }).strict();
const patchSchema = z
	.object({
		assigneeUserId: z.uuid().nullable().optional(),
		dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
		isPinned: z.boolean().optional(),
		status: z.enum(["new", "reviewing", "action_required", "resolved", "dismissed"]).optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, "Cần ít nhất một thay đổi.");

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const { id } = paramsSchema.parse(await context.params);
		return Response.json(await getEvidenceTriageDetails(id), { headers: authHeaders(auth) });
	} catch (error) {
		return triageError(error, authHeaders(auth));
	}
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const { id } = paramsSchema.parse(await context.params);
		const input = patchSchema.parse(await request.json());
		let assigneeDisplayName: string | null | undefined;
		if (input.assigneeUserId !== undefined) {
			if (input.assigneeUserId === null) assigneeDisplayName = null;
			else {
				let members;
				try {
					members = await fetchWorkspaceMembersForRequest(request);
				} catch {
					return Response.json(
						{ error: "Không thể xác minh thành viên CyberShield35. Các cập nhật khác vẫn có thể thực hiện." },
						{ headers: authHeaders(auth), status: 503 },
					);
				}
				const member = members.members.find((candidate) => candidate.id === input.assigneeUserId);
				if (!member) return Response.json({ error: "Người phụ trách không thuộc workspace." }, { headers: authHeaders(auth), status: 400 });
				assigneeDisplayName = member.displayName ?? member.email ?? member.id;
			}
		}
		const { dueAt, ...triageInput } = input;
		const triage = await updateEvidenceTriage(
			id,
			{
				...triageInput,
				...(assigneeDisplayName !== undefined ? { assigneeDisplayName } : {}),
				...(dueAt !== undefined
					? { dueAt: dueAt === null ? null : new Date(dueAt) }
					: {}),
			},
			{ displayName: auth.session.user.displayName ?? null, id: auth.session.user.id },
		);
		revalidateDashboardIntelligence("timeline");
		revalidateDashboardIntelligence("activity");
		return Response.json({ triage }, { headers: authHeaders(auth) });
	} catch (error) {
		return triageError(error, authHeaders(auth));
	}
}

function triageError(error: unknown, headers?: HeadersInit) {
	const status = error instanceof ZodError ? 400 : error instanceof TimelineNotFoundError ? 404 : 503;
	return Response.json(
		{ error: error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Không thể cập nhật xử lý." },
		{ headers, status },
	);
}
