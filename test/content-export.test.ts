import { afterEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";

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
		const pcm = Buffer.from([1, 2, 3, 4]);
		const { pcmToWav } = await import("@/lib/exports/google-tts");
		const wav = pcmToWav(pcm);
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
			"https://tuturuuu.com/api/v1/external-ai/audio/speech",
		);
		expect(headers.get("Authorization")).toBe(
			"Bearer ttr_app_session-token",
		);
		expect(headers.get("X-Tuturuuu-Workspace-Id")).toBe("workspace-1");
		expect(body.model).toBe("google/gemini-3.1-flash-tts-preview");
		expect(result.subarray(44)).toEqual(pcm);
	});

	test("retries one transient Tuturuuu TTS failure", async () => {
		let attempts = 0;
		const pcm = Buffer.from([5, 6, 7, 8]);
		const { pcmToWav } = await import("@/lib/exports/google-tts");
		const wav = pcmToWav(pcm);
		const fetchImpl = mock(async () => {
			attempts += 1;
			return attempts === 1
				? new Response("upstream unavailable", { status: 502 })
				: new Response(wav, { headers: { "Content-Type": "audio/wav" } });
		}) as typeof fetch;
		const { generateVietnameseSpeech } = await import(
			"@/lib/exports/google-tts"
		);

		const result = await generateVietnameseSpeech("Nội dung tiếng Việt.", {
			accessToken: "ttr_app_session-token",
			fetchImpl,
			workspaceId: "workspace-1",
		});

		expect(attempts).toBe(2);
		expect(result.subarray(44)).toEqual(pcm);
	});

	test("splits article-length speech and joins chunks into one WAV", async () => {
		const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
		const { generateVietnameseSpeech, pcmToWav, splitSpeechText } = await import(
			"@/lib/exports/google-tts"
		);
		const content = [
			"Đây là câu đầu tiên của bài viết. ".repeat(12),
			"Đây là đoạn tiếp theo cần được đọc tự nhiên. ".repeat(12),
		].join("\n\n");
		const expectedChunks = splitSpeechText(content, 400);
		const fetchImpl = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push({ input, init });
			const index = calls.length;
			return new Response(pcmToWav(Buffer.from([index, index + 1])), {
				headers: { "Content-Type": "audio/wav" },
			});
		}) as typeof fetch;

		const result = await generateVietnameseSpeech(content, {
			accessToken: "ttr_app_session-token",
			fetchImpl,
			workspaceId: "workspace-1",
		});

		expect(calls).toHaveLength(expectedChunks.length);
		expect(expectedChunks.length).toBeGreaterThan(1);
		for (const call of calls) {
			const body = JSON.parse(String(call.init?.body));
			expect(body.input.length).toBeLessThanOrEqual(400);
		}
		expect(result.subarray(0, 4).toString()).toBe("RIFF");
		expect(result.subarray(8, 12).toString()).toBe("WAVE");
		expect(result.length).toBeGreaterThan(44 + expectedChunks.length * 2);
	});

	test("keeps every speech chunk within the provider limit", async () => {
		const { splitSpeechText } = await import("@/lib/exports/google-tts");
		const chunks = splitSpeechText(`Mở ${"x".repeat(850)} để kiểm tra.`, 400);

		expect(chunks.length).toBeGreaterThan(2);
		expect(chunks.every((chunk) => chunk.length <= 400)).toBe(true);
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

	test("accepts article-length titles as export filenames", async () => {
		process.env.AUTH_LOCAL_BYPASS = "true";
		const { POST } = await import("@/app/api/exports/route");
		const longArticleTitle = "B".repeat(150);
		const response = await POST(
			new Request("http://localhost/api/exports", {
				body: JSON.stringify({
					content: "Nội dung bài viết tiếng Việt.",
					fileName: longArticleTitle,
					format: "docx",
					title: longArticleTitle,
				}),
				headers: {
					"Content-Type": "application/json",
					host: "localhost",
				},
				method: "POST",
			}),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toContain(
			`${"B".repeat(80)}.docx`,
		);
	});

	test("normalizes client export filenames to the API-safe limit", async () => {
		const { normalizeExportFileName } = await import(
			"@/components/dashboard/export-actions"
		);

		expect(normalizeExportFileName(`  ${"Tên".repeat(60)}  `).length).toBe(120);
		expect(normalizeExportFileName("   ")).toBe("cybershield35-export");
	});

	test("keeps object URLs alive until Chrome has claimed the download", () => {
		const source = readFileSync(
			"components/dashboard/export-actions.tsx",
			"utf8",
		);

		expect(source).toContain("if (!blob.size || mediaType !== exportMediaTypes[format])");
		expect(source).toContain(
			"setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS)",
		);
		expect(source).not.toContain("anchor.remove();\n\t\t\tURL.revokeObjectURL(url);");
	});
});
