import { afterEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const originalEnv = { ...process.env };

afterEach(() => {
	process.env = { ...originalEnv };
});

describe("content exports", () => {
	test("generates real Word and PDF files with Vietnamese content", async () => {
		const { createDocxExport, createPdfExport } = await import(
			"@/lib/exports/content-export"
		);
		const input = {
			content:
				"Nội dung tiếng Việt tự nhiên, rõ ràng và trôi chảy.\n\nBảo vệ cộng đồng trên không gian mạng.",
			title: "Báo cáo CyberShield35",
		};

		const [docx, pdf] = await Promise.all([
			createDocxExport(input),
			createPdfExport(input),
		]);

		expect(docx.subarray(0, 2).toString()).toBe("PK");
		expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
		expect(docx.length).toBeGreaterThan(1_000);
		expect(pdf.length).toBeGreaterThan(1_000);
	});

	test("removes inline citation markers before export", async () => {
		const { cleanDraftContent } = await import("@/lib/domain/draft-content");

		expect(
			cleanDraftContent(
				"Luận điểm đã được xác minh [1]. Nội dung tiếp theo【2】 vẫn tự nhiên.",
			),
		).toBe(
			"Luận điểm đã được xác minh. Nội dung tiếp theo vẫn tự nhiên.",
		);
	});

	test("uses Tuturuuu's Gemini TTS model and returns downloadable WAV audio", async () => {
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-google-key";
		const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
		const pcm = Buffer.from([0, 1, 2, 3, 4, 5]);
		const fetchImpl = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push({ input, init });
			return Response.json({
				output: {
					content: [
						{
							inlineData: {
								data: pcm.toString("base64"),
								mimeType: "audio/L16;codec=pcm;rate=24000",
							},
						},
					],
				},
			});
		}) as typeof fetch;
		const { generateVietnameseSpeech } = await import(
			"@/lib/exports/google-tts"
		);

		const wav = await generateVietnameseSpeech(
			"Đây là bản đọc tiếng Việt tự nhiên.",
			{ fetchImpl },
		);
		const body = JSON.parse(String(calls[0]?.init?.body));

		expect(String(calls[0]?.input)).toBe(
			"https://generativelanguage.googleapis.com/v1beta/interactions",
		);
		expect(body.model).toBe("gemini-3.1-flash-tts-preview");
		expect(body.generation_config.speech_config[0].voice).toBe("Puck");
		expect(body.input).toContain("giọng tự nhiên, rõ ràng và trôi chảy");
		expect(wav.subarray(0, 4).toString()).toBe("RIFF");
		expect(wav.subarray(8, 12).toString()).toBe("WAVE");
		expect(wav.length).toBe(44 + pcm.length);
	});

	test("routes authenticated external-app TTS through Tuturuuu AI", async () => {
		const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
		const wav = Buffer.from("RIFFmock-wave");
		const fetchImpl = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push({ input, init });
			return new Response(wav, {
				headers: { "Content-Type": "audio/wav" },
			});
		}) as typeof fetch;
		const { generateVietnameseSpeech } = await import(
			"@/lib/exports/google-tts"
		);

		const result = await generateVietnameseSpeech("Nội dung tiếng Việt.", {
			accessToken: "ttr_app_session-token",
			fetchImpl,
			workspaceId: "workspace-1",
		});
		const headers = new Headers(calls[0]?.init?.headers);
		const body = JSON.parse(String(calls[0]?.init?.body));

		expect(String(calls[0]?.input)).toBe(
			"https://ai.tuturuuu.com/v1/audio/speech",
		);
		expect(headers.get("Authorization")).toBe(
			"Bearer ttr_app_session-token",
		);
		expect(headers.get("X-Tuturuuu-Workspace-Id")).toBe("workspace-1");
		expect(body.model).toBe("gemini-3.1-flash-tts-preview");
		expect(result).toEqual(wav);
	});

	test("requires authentication before producing an export", async () => {
		delete process.env.AUTH_LOCAL_BYPASS;
		const { POST } = await import("@/app/api/exports/route");
		const response = await POST(
			new Request("http://localhost/api/exports", {
				body: JSON.stringify({
					content: "Nội dung",
					fileName: "bao-cao",
					format: "pdf",
					title: "Báo cáo",
				}),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			}),
		);

		expect(response.status).toBe(401);
	});

	test("returns a Word attachment from the authenticated export route", async () => {
		process.env.AUTH_LOCAL_BYPASS = "true";
		const { POST } = await import("@/app/api/exports/route");
		const response = await POST(
			new Request("http://localhost/api/exports", {
				body: JSON.stringify({
					content: "Bản nháp tiếng Việt.",
					fileName: "bản nháp thử nghiệm",
					format: "docx",
					title: "Bản nháp",
				}),
				headers: {
					"Content-Type": "application/json",
					host: "localhost",
				},
				method: "POST",
			}),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain(
			"application/vnd.openxmlformats-officedocument",
		);
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="ban-nhap-thu-nghiem.docx"',
		);
		expect(Buffer.from(await response.arrayBuffer()).subarray(0, 2).toString()).toBe(
			"PK",
		);
	});
});
