import "server-only";

const DEFAULT_GOOGLE_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_GOOGLE_TTS_VOICE = "Puck";
const GOOGLE_TTS_TIMEOUT_MS = 60_000;
const SAMPLE_RATE = 24_000;

export async function generateVietnameseSpeech(
	text: string,
	options: {
		accessToken?: string;
		fetchImpl?: typeof fetch;
		signal?: AbortSignal;
		workspaceId?: string | null;
	} = {},
) {
	if (
		options.accessToken?.startsWith("ttr_app_") &&
		options.workspaceId
	) {
		return generateWithTuturuuu(text, {
			accessToken: options.accessToken,
			fetchImpl: options.fetchImpl,
			signal: options.signal,
			workspaceId: options.workspaceId,
		});
	}
	const apiKey =
		process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_API_KEY;
	if (!apiKey) {
		throw new SpeechGenerationError(
			"Google TTS chưa được cấu hình.",
			"missing_api_key",
		501,
		);
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), GOOGLE_TTS_TIMEOUT_MS);
	const signal = options.signal
		? AbortSignal.any([options.signal, controller.signal])
		: controller.signal;

	try {
		const response = await (options.fetchImpl ?? fetch)(
			"https://generativelanguage.googleapis.com/v1beta/interactions",
			{
				body: JSON.stringify({
					generation_config: {
						speech_config: [
							{
								voice:
									process.env.GOOGLE_TTS_VOICE ?? DEFAULT_GOOGLE_TTS_VOICE,
							},
						],
					},
					input: [
						"Đọc nguyên văn nội dung tiếng Việt sau bằng giọng tự nhiên, rõ ràng và trôi chảy.",
						"Giữ nhịp đọc điềm tĩnh, ngắt nghỉ theo dấu câu. Chỉ đọc nội dung, không thêm lời dẫn.",
						"",
						text,
					].join("\n"),
					model: process.env.GOOGLE_TTS_MODEL ?? DEFAULT_GOOGLE_TTS_MODEL,
					response_format: { type: "audio" },
				}),
				headers: {
					"Content-Type": "application/json",
					"x-goog-api-key": apiKey,
				},
				method: "POST",
				signal,
			},
		);

		if (!response.ok) {
			console.error("Google TTS export failed", { status: response.status });
			throw new SpeechGenerationError(
				"Không thể tạo bản đọc lúc này.",
				"provider_error",
				502,
			);
		}

		const pcm = audioFromGeminiResponse(await response.json());
		if (!pcm) {
			throw new SpeechGenerationError(
				"Phản hồi Google TTS không chứa âm thanh.",
				"missing_audio",
				502,
			);
		}

		return pcmToWav(pcm);
	} catch (error) {
		if (error instanceof SpeechGenerationError) throw error;
		if (
			(error instanceof DOMException && error.name === "AbortError") ||
			controller.signal.aborted
		) {
			throw new SpeechGenerationError(
				"Google TTS phản hồi quá chậm. Vui lòng thử lại.",
				"timeout",
				504,
			);
		}
		throw new SpeechGenerationError(
			"Không thể kết nối Google TTS.",
			"network_error",
			502,
		);
	} finally {
		clearTimeout(timeout);
	}
}

async function generateWithTuturuuu(
	text: string,
	options: {
		accessToken: string;
		fetchImpl?: typeof fetch;
		signal?: AbortSignal;
		workspaceId: string;
	},
) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), GOOGLE_TTS_TIMEOUT_MS);
	const signal = options.signal
		? AbortSignal.any([options.signal, controller.signal])
		: controller.signal;
	try {
		const baseUrl =
			process.env.TUTURUUU_AI_BASE_URL?.trim() ??
			"https://ai.tuturuuu.com/v1";
		const response = await (options.fetchImpl ?? fetch)(
			`${baseUrl.replace(/\/+$/u, "")}/audio/speech`,
			{
				body: JSON.stringify({
					input: text,
					instructions:
						"Đọc tiếng Việt tự nhiên, rõ ràng, điềm tĩnh; ngắt nghỉ theo dấu câu và không thêm lời dẫn.",
					model:
						process.env.TUTURUUU_TTS_MODEL?.trim() ??
						DEFAULT_GOOGLE_TTS_MODEL,
					response_format: "wav",
					voice: process.env.TUTURUUU_TTS_VOICE?.trim() ?? "Kore",
				}),
				headers: {
					Authorization: `Bearer ${options.accessToken}`,
					"Content-Type": "application/json",
					"X-Tuturuuu-Workspace-Id": options.workspaceId,
				},
				method: "POST",
				signal,
			},
		);
		if (!response.ok) {
			console.error("Tuturuuu TTS export failed", { status: response.status });
			throw new SpeechGenerationError(
				"Không thể tạo bản đọc qua Tuturuuu AI lúc này.",
				"provider_error",
				response.status === 403 ? 403 : 502,
			);
		}
		return Buffer.from(await response.arrayBuffer());
	} catch (error) {
		if (error instanceof SpeechGenerationError) throw error;
		if (controller.signal.aborted) {
			throw new SpeechGenerationError(
				"Tuturuuu TTS phản hồi quá chậm. Vui lòng thử lại.",
				"timeout",
				504,
			);
		}
		throw new SpeechGenerationError(
			"Không thể kết nối Tuturuuu TTS.",
			"network_error",
			502,
		);
	} finally {
		clearTimeout(timeout);
	}
}

export class SpeechGenerationError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly status: number,
	) {
		super(message);
		this.name = "SpeechGenerationError";
	}
}

export function pcmToWav(pcm: Uint8Array) {
	const header = Buffer.alloc(44);
	const byteRate = SAMPLE_RATE * 2;
	header.write("RIFF", 0);
	header.writeUInt32LE(36 + pcm.length, 4);
	header.write("WAVE", 8);
	header.write("fmt ", 12);
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20);
	header.writeUInt16LE(1, 22);
	header.writeUInt32LE(SAMPLE_RATE, 24);
	header.writeUInt32LE(byteRate, 28);
	header.writeUInt16LE(2, 32);
	header.writeUInt16LE(16, 34);
	header.write("data", 36);
	header.writeUInt32LE(pcm.length, 40);
	return Buffer.concat([header, Buffer.from(pcm)]);
}

export function audioFromGeminiResponse(value: unknown): Buffer | null {
	const encoded = findBase64AudioData(value);
	return encoded ? Buffer.from(encoded, "base64") : null;
}

function findBase64AudioData(value: unknown): string | null {
	if (!value || typeof value !== "object") return null;
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findBase64AudioData(item);
			if (found) return found;
		}
		return null;
	}

	const record = value as Record<string, unknown>;
	for (const key of ["output_audio", "outputAudio", "audio", "audioData"]) {
		const candidate = record[key];
		if (typeof candidate === "string") return candidate;
		if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
			const data = (candidate as Record<string, unknown>).data;
			if (typeof data === "string") return data;
		}
	}

	const inline = record.inlineData ?? record.inline_data;
	if (inline && typeof inline === "object" && !Array.isArray(inline)) {
		const data = (inline as Record<string, unknown>).data;
		if (typeof data === "string") return data;
	}

	if (
		typeof record.data === "string" &&
		typeof (record.mimeType ?? record.mime_type ?? record.type) === "string" &&
		String(record.mimeType ?? record.mime_type ?? record.type)
			.toLowerCase()
			.includes("audio")
	) {
		return record.data;
	}

	for (const child of Object.values(record)) {
		const found = findBase64AudioData(child);
		if (found) return found;
	}
	return null;
}
