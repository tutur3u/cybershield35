import { describe, expect, test } from "bun:test";

import {
	AUTOMATIC_DRAFT_WRITING_BRIEF,
	DEFAULT_DRAFT_VOICE,
	DEFAULT_DRAFT_WRITING_BRIEF,
	DRAFT_TONES,
	DRAFT_TONE_OPTIONS,
	DRAFT_VOICES,
	DRAFT_VOICE_OPTIONS,
	NATURAL_VIETNAMESE_WRITING_GUIDANCE,
	draftWritingBriefForMode,
	resolveDraftGenerationStyle,
} from "@/lib/domain/draft-style";
import {
	DRAFT_KIND_LABELS,
	draftIntentGuidance,
} from "@/lib/domain/draft-intent";
import {
	generateCounterArgumentWithEvidenceFallback,
	isContextReducibleAiError,
	reviseCounterArgumentWithEvidenceFallback,
} from "@/lib/llm/generation";

describe("AI draft style", () => {
	test("offers distinct tone and voice controls with a natural default", () => {
		expect(DRAFT_TONES.length).toBeGreaterThan(2);
		expect(DRAFT_VOICES.length).toBeGreaterThan(2);
		expect(DRAFT_VOICES).toContain(DEFAULT_DRAFT_VOICE);
		expect(DRAFT_TONE_OPTIONS.every((option) => option.description)).toBe(true);
		expect(DRAFT_VOICE_OPTIONS.every((option) => option.description)).toBe(true);
	});

	test("retries an AI rewrite with the current evidence when the provider rejects a large context", async () => {
		const attempts: string[][] = [];
		const output = await reviseCounterArgumentWithEvidenceFallback(
			{
				audience: "Công chúng chung",
				currentBody: "Bản nháp hiện tại",
				draftKind: "counter_argument",
				evidence: [
					{ id: "current", quote: "Bằng chứng chính", summary: "Ý chính" },
					{ id: "related", quote: "Bằng chứng phụ", summary: "Ngữ cảnh" },
				],
				instruction: "Viết dài hơn một chút",
				language: "vi",
				length: "Dài hơn khoảng 20–35%",
				tone: "Điềm tĩnh, khách quan",
				voice: DEFAULT_DRAFT_VOICE,
			},
			async (input) => {
				attempts.push(input.evidence.map((item) => item.id));
				if (input.evidence.length > 1) throw new Error("Bad Request");
				return {
					body: "Bản sửa dài hơn và có căn cứ.",
					citations: [{ evidenceId: "current", label: "Bằng chứng chính" }],
					safetyNotes: [],
				};
			},
		);

		expect(attempts).toEqual([["current", "related"], ["current"]]);
		expect(output.body).toContain("dài hơn");
		expect(output.safetyNotes.join(" ")).toContain("bằng chứng đang mở");
	});

	test("forces automatic drafts to natural Vietnamese defaults", () => {
		expect(
			resolveDraftGenerationStyle({
				language: "English",
				mode: "automatic",
				voice: "Chuyên nghiệp, chuẩn mực",
			}),
		).toEqual({
			language: "vi",
			voice: DEFAULT_DRAFT_VOICE,
		});
		expect(draftWritingBriefForMode("automatic")).toBe(
			AUTOMATIC_DRAFT_WRITING_BRIEF,
		);
		expect(AUTOMATIC_DRAFT_WRITING_BRIEF.automation.join(" ")).toContain(
			"do not sound templated",
		);
		expect(AUTOMATIC_DRAFT_WRITING_BRIEF.automation.join(" ")).toContain(
			"Never mention automation",
		);
	});

	test("requires native, fluent Vietnamese instead of translated AI prose", () => {
		expect(NATURAL_VIETNAMESE_WRITING_GUIDANCE).toContain(
			"native Vietnamese editor",
		);
		expect(NATURAL_VIETNAMESE_WRITING_GUIDANCE).toContain("idiomatic wording");
		expect(NATURAL_VIETNAMESE_WRITING_GUIDANCE).toContain("literal translation");
		expect(NATURAL_VIETNAMESE_WRITING_GUIDANCE).toContain("formulaic AI phrases");
		expect(NATURAL_VIETNAMESE_WRITING_GUIDANCE).toContain("Dưới đây là");
		expect(DEFAULT_DRAFT_WRITING_BRIEF.format).toContain(
			"two to four short paragraphs",
		);
		expect(DEFAULT_DRAFT_WRITING_BRIEF.flow).toContain(
			"Open directly with the central point instead of announcing the response.",
		);
	});

	test("makes support and rebuttal intents explicit", () => {
		expect(DRAFT_KIND_LABELS.response).toBe("Ủng hộ quan điểm");
		expect(DRAFT_KIND_LABELS.counter_argument).toBe("Phản bác quan điểm");
		expect(draftIntentGuidance("counter_argument").requirements.join(" ")).toContain(
			"không được chỉ tóm tắt",
		);
		expect(draftIntentGuidance("response").goal).toContain("đồng tình");
	});

	test("retries a rejected multi-evidence draft with the current evidence only", async () => {
		const evidence = [
			{ id: "current", quote: "Bằng chứng đang mở", summary: "Nội dung chính" },
			{ id: "related", quote: "Bằng chứng liên quan", summary: "Ngữ cảnh thêm" },
		];
		const attempts: string[][] = [];
		const output = await generateCounterArgumentWithEvidenceFallback(
			{
				audience: "Công chúng chung",
				evidence,
				language: "vi",
				length: "medium",
				tone: "Điềm tĩnh, khách quan",
				voice: DEFAULT_DRAFT_VOICE,
			},
			async (input) => {
				attempts.push(input.evidence.map((item) => item.id));
				if (input.evidence.length > 1) throw new Error("Bad Request");
				return {
					body: "Bản nháp dùng bằng chứng đang mở.",
					citations: [{ evidenceId: "current", label: "Bằng chứng đang mở" }],
					safetyNotes: [],
				};
			},
		);

		expect(attempts).toEqual([
			["current", "related"],
			["current"],
		]);
		expect(output.safetyNotes.join(" ")).toContain(
			"chỉ dùng bằng chứng đang mở",
		);
		expect(isContextReducibleAiError(new Error("Bad Request"))).toBe(true);
		expect(isContextReducibleAiError(new Error("Unauthorized"))).toBe(false);
	});
});
