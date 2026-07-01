import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { revalidateDashboardScan } from "@/lib/dashboard/cache-invalidation";
import { createScan, listScansPage } from "@/lib/workers/scans";

const scanBodySchema = z.object({
	input: z.string().min(1),
	title: z.string().optional(),
	providerOverride: z.literal("browser_use").optional(),
}).strict();

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const searchParams = new URL(request.url).searchParams;
		const cursor = searchParams.get("cursor");
		const limit = Number(searchParams.get("limit") ?? "25");
		const page = await listScansPage({ cursor, limit });
		return Response.json(
			{
				hasNextPage: page.hasNextPage,
				items: page.items,
				limit: page.limit,
				mode: "live",
				nextCursor: page.nextCursor,
				scans: page.items,
			},
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
			if (formData.has("clientRuntime")) {
				return Response.json(
					{ error: "Provider keys must be configured on the server" },
					{ status: 400, headers: authHeaders(auth) },
				);
			}

			const fileText = await readFileText(file);
			const result = await createScan({
				input: input || file.name,
				title: title || file.name,
				fileName: file.name,
				mimeType: file.type || "application/octet-stream",
				fileText,
			});
			revalidateDashboardScan(result.scanId);
			return Response.json(result, {
				status: 201,
				headers: authHeaders(auth),
			});
		}

		const body = scanBodySchema.parse(await request.json());
		const result = await createScan(body);
		revalidateDashboardScan(result.scanId);
		return Response.json(result, { status: 201, headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}

		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
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
