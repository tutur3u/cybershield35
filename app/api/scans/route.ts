import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import {
	parseClientRuntime,
	parseClientRuntimeFormValue,
	redactRuntimeSecrets,
} from "@/lib/runtime/client-runtime";
import { createScan, listScans } from "@/lib/workers/scans";

export const runtime = "nodejs";

const scanBodySchema = z.object({
	input: z.string().min(1),
	title: z.string().optional(),
	providerOverride: z.literal("browser_use").optional(),
	clientRuntime: z.unknown().optional(),
});

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		return Response.json(
			{ scans: await listScans(), mode: "live" },
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

export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	let requestRuntime = parseClientRuntime(undefined);

	try {
		const contentType = request.headers.get("content-type") ?? "";

		if (contentType.includes("multipart/form-data")) {
			const formData = await request.formData();
			const file = formData.get("file");
			const input = String(formData.get("input") ?? "");
			const title = String(formData.get("title") ?? "");

			if (!(file instanceof File)) {
				return Response.json({ error: "Missing file upload" }, { status: 400 });
			}

			const fileText = await readFileText(file);
			requestRuntime = parseClientRuntimeFormValue(formData.get("clientRuntime"));
			const result = await createScan(
				{
					input: input || file.name,
					title: title || file.name,
					fileName: file.name,
					mimeType: file.type || "application/octet-stream",
					fileText,
				},
				requestRuntime,
			);
			return Response.json(result, {
				status: 201,
				headers: authHeaders(auth),
			});
		}

		const body = scanBodySchema.parse(await request.json());
		requestRuntime = parseClientRuntime(body.clientRuntime);
		const result = await createScan(body, requestRuntime);
		return Response.json(result, { status: 201, headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}

		return Response.json(
			{
				error:
					error instanceof Error
						? redactRuntimeSecrets(error.message, requestRuntime)
						: "Failed to create scan",
			},
			{ status: 500 },
		);
	}
}

async function readFileText(file: File) {
	const textLike =
		file.type.startsWith("text/") ||
		file.name.endsWith(".csv") ||
		file.name.endsWith(".json") ||
		file.name.endsWith(".md") ||
		file.name.endsWith(".txt");

	if (textLike) return file.text();
	return `Uploaded binary file: ${file.name} (${file.type || "unknown type"}, ${file.size} bytes). Configure FIRECRAWL_API_KEY to parse non-text documents.`;
}
