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

describe("AI draft style", () => {
	test("offers distinct tone and voice controls with a natural default", () => {
		expect(DRAFT_TONES.length).toBeGreaterThan(2);
		expect(DRAFT_VOICES.length).toBeGreaterThan(2);
		expect(DRAFT_VOICES).toContain(DEFAULT_DRAFT_VOICE);
		expect(DRAFT_TONE_OPTIONS.every((option) => option.description)).toBe(true);
		expect(DRAFT_VOICE_OPTIONS.every((option) => option.description)).toBe(true);
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
});
