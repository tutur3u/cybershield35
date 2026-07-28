import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { revalidateDashboardScan } from "@/lib/dashboard/cache-invalidation";
import { publicErrorMessage } from "@/lib/http/public-error";
import {
	createScan,
	findScanByClientRequestId,
	listScansPage,
	processScanJobNow,
} from "@/lib/workers/scans";

const scanBodySchema = z.object({
	input: z.string().min(1),
	title: z.string().optional(),
	providerOverride: z.literal("browser_use").optional(),
	clientRequestId: z.string().uuid().optional(),
	runMode: z.enum(["now", "queue"]).default("now"),
}).strict();

export const maxDuration = 60;

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const searchParams = new URL(request.url).searchParams;
		const requestId = searchParams.get("requestId");
		if (requestId) {
			const scan = await findScanByClientRequestId(
				z.string().uuid().parse(requestId),
			);
			return Response.json({ scan }, { headers: authHeaders(auth) });
		}
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
				error: publicErrorMessage(error, "Không thể tải danh sách scan."),
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
		const actor = actorFromAuth(auth);

		if (contentType.includes("multipart/form-data")) {
			const formData = await request.formData();
			const file = formData.get("file");
			const input = String(formData.get("input") ?? "");
			const title = String(formData.get("title") ?? "");
			const runMode = formData.get("runMode") === "queue" ? "queue" : "now";
			const clientRequestId = String(formData.get("clientRequestId") ?? "");

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
				clientRequestId: clientRequestId || undefined,
				requestedByDisplayName: actor.displayName,
				requestedByUserId: actor.id,
			});
			const processing =
				runMode === "now" ? await processScanJobNow(result.scanId) : null;
			revalidateDashboardScan(result.scanId);
			return Response.json({ ...result, processing }, {
				status: 201,
				headers: authHeaders(auth),
			});
		}

		const body = scanBodySchema.parse(await request.json());
		const { runMode, ...scanInput } = body;
		const result = await createScan({
			...scanInput,
			requestedByDisplayName: actor.displayName,
			requestedByUserId: actor.id,
		});
		const processing =
			runMode === "now" ? await processScanJobNow(result.scanId) : null;
		revalidateDashboardScan(result.scanId);
		return Response.json(
			{ ...result, processing },
			{ status: 201, headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}

		return Response.json(
			{
				error: publicErrorMessage(error, "Không thể tạo lượt quét."),
			},
			{ status: 500, headers: authHeaders(auth) },
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
