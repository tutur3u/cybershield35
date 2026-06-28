import { z } from "zod";

import {
	buildTuturuuuApiUrl,
	getBearerForPlatformRequest,
	sanitizeAuthError,
} from "@/lib/auth/tuturuuu-session";
import {
	buildTuturuuuScopeApprovalUrlForRequest,
	isTuturuuuScopeNotAllowedError,
} from "@/lib/auth/scope-approval";
import type { WorkspaceMembersResponse } from "@/components/dashboard/types";

const MAX_EMAILS = 50;

export const inviteWorkspaceMembersSchema = z
	.object({
		emails: z.array(z.email()).min(1).max(MAX_EMAILS),
	})
	.strict();

export const removeWorkspaceAccessSchema = z
	.object({
		email: z.email().optional(),
		userId: z.string().trim().min(1).max(128).optional(),
	})
	.strict()
	.refine((value) => Boolean(value.email || value.userId));

export const updateWorkspaceMemberRoleSchema = z
	.object({
		confirmDefaultAdminDisable: z.boolean().optional(),
		role: z.enum(["admin", "member"]),
	})
	.strict();

export const updateDefaultAdminSchema = z
	.object({
		enabled: z.boolean(),
	})
	.strict();

export async function proxyWorkspaceMembersRequest(
	request: Request,
	input: {
		body?: unknown;
		method: "DELETE" | "GET" | "PATCH" | "POST";
		path: string;
	},
) {
	try {
		const auth = await getBearerForPlatformRequest(request);
		const response = await fetch(buildWorkspaceMembersUrl(input.path), {
			body: input.body === undefined ? undefined : JSON.stringify(input.body),
			cache: "no-store",
			headers: {
				Authorization: auth.authorization,
				...(input.body === undefined
					? {}
					: { "Content-Type": "application/json" }),
			},
			method: input.method,
		});
		const body = await response.json().catch(() => null);

		return json(body ?? fallbackBody(response.status), {
			setCookie: auth.setCookie,
			status: response.status,
		});
	} catch (error) {
		const safe = sanitizeAuthError(error);
		return json(scopeAwareErrorBody(safe, request), { status: safe.status });
	}
}

export async function fetchWorkspaceMembersForRequest(request: Request) {
	const auth = await getBearerForPlatformRequest(request);
	const response = await fetch(buildWorkspaceMembersUrl(""), {
		cache: "no-store",
		headers: { Authorization: auth.authorization },
		method: "GET",
	});
	const body = await response.json().catch(() => null);

	if (!response.ok) {
		const message =
			body && typeof body === "object" && "error" in body
				? String(body.error)
				: "Workspace members unavailable";
		throw new Error(message);
	}

	return body as WorkspaceMembersResponse;
}

export function buildWorkspaceMembersUrl(path: string) {
	const workspaceId = process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID?.trim();
	if (!workspaceId) {
		throw new Error("Missing workspace configuration");
	}

	const suffix = path.replace(/^\/+/u, "");
	return buildTuturuuuApiUrl(
		`workspaces/${encodeURIComponent(workspaceId)}/external-apps/members${
			suffix ? `/${suffix}` : ""
		}`,
	);
}

function fallbackBody(status: number) {
	return status >= 400
		? { error: "Workspace member request failed" }
		: { ok: true };
}

function scopeAwareErrorBody(
	safe: { message: string; status: number },
	request: Request,
) {
	return {
		error: safe.message,
		scopeApprovalHref: isTuturuuuScopeNotAllowedError({
			error: safe.message,
			status: safe.status,
		})
			? buildTuturuuuScopeApprovalUrlForRequest(request)
			: undefined,
	};
}

export function json(
	body: unknown,
	options: { setCookie?: string | null; status?: number } = {},
) {
	const headers = new Headers({ "Cache-Control": "no-store" });
	if (options.setCookie) headers.set("Set-Cookie", options.setCookie);
	return Response.json(body, { headers, status: options.status });
}
