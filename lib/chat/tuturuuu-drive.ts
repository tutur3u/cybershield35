import "server-only";

import { z } from "zod";

const providerSchema = z.enum(["r2", "supabase"]);
const uploadPayloadSchema = z.object({
	contentType: z.string().optional(),
	expiresIn: z.number(),
	filename: z.string(),
	fullPath: z.string(),
	headers: z.record(z.string(), z.string()).optional(),
	path: z.string(),
	provider: providerSchema,
	signedUrl: z.string().url(),
	token: z.string().optional(),
});
const objectSchema = z.object({
	contentType: z.string(),
	fullPath: z.string(),
	path: z.string(),
	provider: providerSchema,
	size: z.number().int().positive(),
});
const readSchema = z.object({
	expiresIn: z.number(),
	provider: providerSchema,
	signedUrl: z.string().url(),
});

export type TuturuuuDriveUpload = z.infer<typeof uploadPayloadSchema>;

function workspaceId() {
	const value = process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID?.trim();
	if (!value) throw new Error("Tuturuuu Drive workspace is not configured.");
	return value;
}

function apiBaseUrl() {
	const raw = process.env.TUTURUUU_API_BASE_URL?.trim() || "https://tuturuuu.com/api/v1";
	return raw.replace(/\/+$/u, "").replace(/\/api\/v1$/u, "");
}

async function driveRequest(
	accessToken: string,
	suffix: string,
	method: "DELETE" | "POST",
	payload: unknown,
) {
	const response = await fetch(
		`${apiBaseUrl()}/api/v1/workspaces/${encodeURIComponent(workspaceId())}/external-apps/drive${suffix}`,
		{
			body: JSON.stringify(payload),
			cache: "no-store",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			method,
		},
	);
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		const message =
			body && typeof body === "object" && "error" in body
				? String(body.error)
				: "Tuturuuu Drive request failed";
		const error = new Error(message) as Error & { status?: number };
		error.status = response.status;
		throw error;
	}
	return body;
}

export async function createTuturuuuDriveUpload(
	accessToken: string,
	payload: {
		attachmentId: string;
		contentType: string;
		conversationId: string;
		filename: string;
		size: number;
	},
) {
	return uploadPayloadSchema.parse(
		await driveRequest(accessToken, "/upload-url", "POST", payload),
	);
}

export async function finalizeTuturuuuDriveUpload(
	accessToken: string,
	payload: {
		contentType: string;
		path: string;
		provider: "r2" | "supabase";
		size: number;
	},
) {
	return objectSchema.parse(
		await driveRequest(accessToken, "/finalize", "POST", payload),
	);
}

export async function createTuturuuuDriveReadUrl(
	accessToken: string,
	payload: { path: string; provider: "r2" | "supabase" },
) {
	return readSchema.parse(
		await driveRequest(accessToken, "/read-url", "POST", payload),
	);
}

export async function deleteTuturuuuDriveObject(
	accessToken: string,
	payload: { path: string },
) {
	return z
		.object({ deleted: z.literal(true), provider: providerSchema })
		.parse(await driveRequest(accessToken, "", "DELETE", payload));
}
