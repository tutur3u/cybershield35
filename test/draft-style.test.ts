import { describe, expect, test } from "bun:test";

import {
	DEFAULT_DRAFT_VOICE,
	DRAFT_TONES,
	DRAFT_VOICES,
	NATURAL_VIETNAMESE_WRITING_GUIDANCE,
} from "@/lib/domain/draft-style";

describe("AI draft style", () => {
	test("offers distinct tone and voice controls with a natural default", () => {
		expect(DRAFT_TONES.length).toBeGreaterThan(2);
		expect(DRAFT_VOICES.length).toBeGreaterThan(2);
		expect(DRAFT_VOICES).toContain(DEFAULT_DRAFT_VOICE);
	});

	test("requires native, fluent Vietnamese instead of translated AI prose", () => {
		expect(NATURAL_VIETNAMESE_WRITING_GUIDANCE).toContain(
			"native Vietnamese editor",
		);
		expect(NATURAL_VIETNAMESE_WRITING_GUIDANCE).toContain("idiomatic wording");
		expect(NATURAL_VIETNAMESE_WRITING_GUIDANCE).toContain("literal translation");
		expect(NATURAL_VIETNAMESE_WRITING_GUIDANCE).toContain("formulaic AI phrases");
	});
});
