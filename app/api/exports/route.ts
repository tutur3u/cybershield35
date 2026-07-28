import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import {
	createDocxExport,
	createPdfExport,
} from "@/lib/exports/content-export";
import {
	generateVietnameseSpeech,
	SpeechGenerationError,
} from "@/lib/exports/google-tts";

const bodySchema = z
	.object({
		content: z.string().trim().min(1).max(20_000),
		fileName: z.string().trim().min(1).max(120),
		format: z.enum(["docx", "pdf", "wav"]),
		title: z.string().trim().min(1).max(160),
	})
	.strict();

const formats = {
	docx: {
		extension: "docx",
		mediaType:
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	},
	pdf: { extension: "pdf", mediaType: "application/pdf" },
	wav: { extension: "wav", mediaType: "audio/wav" },
} as const;

export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const input = bodySchema.parse(await request.json());
		const bytes =
			input.format === "docx"
				? await createDocxExport(input)
				: input.format === "pdf"
					? await createPdfExport(input)
					: await generateVietnameseSpeech(input.content, {
							accessToken: auth.session.accessToken,
							signal: request.signal,
							workspaceId: auth.session.workspaceId,
						});
		const format = formats[input.format];
		const fileName = safeFileName(input.fileName);
		const headers = new Headers(authHeaders(auth));
		headers.set("Cache-Control", "private, no-store");
		headers.set(
			"Content-Disposition",
			`attachment; filename="${fileName}.${format.extension}"`,
		);
		headers.set("Content-Type", format.mediaType);
		headers.set("X-Content-Type-Options", "nosniff");

		return new Response(new Uint8Array(bytes), { headers });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{
					details: z.treeifyError(error),
					error: "Nội dung xuất không hợp lệ.",
				},
				{ headers: authHeaders(auth), status: 400 },
			);
		}
		if (error instanceof SpeechGenerationError) {
			return Response.json(
				{ code: error.code, error: error.message },
				{ headers: authHeaders(auth), status: error.status },
			);
		}
		console.error("Content export failed", { error });
		return Response.json(
			{ error: "Không thể tạo tệp xuất. Vui lòng thử lại." },
			{ headers: authHeaders(auth), status: 500 },
		);
	}
}

function safeFileName(value: string) {
	const normalized = value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/đ/gi, (letter) => (letter === "Đ" ? "D" : "d"))
		.replace(/[^a-zA-Z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	return normalized || "cybershield35-export";
}
