import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
	automatedDraftPolicy,
	facebookPageIdentity,
} from "@/lib/domain/facebook-page-policy";
import { DEFAULT_DRAFT_VOICE } from "@/lib/domain/draft-style";

describe("Facebook page policy", () => {
	test("uses a stable Facebook ID before the mutable username", () => {
		expect(
			facebookPageIdentity({
				author: "@Trusted.Page",
				facebookPageId: "123456",
				sourceUrl: "https://facebook.com/trusted.page/posts/1",
			}),
		).toEqual({
			facebookPageId: "123456",
			pageKey: "id:123456",
			username: "trusted.page",
		});
	});

	test("drafts constructive trusted content and counterarguments for at-risk pages", () => {
		expect(
			automatedDraftPolicy({
				classification: "trusted",
				riskLevel: "low",
				sentiment: "positive",
				stance: "supportive",
			}),
		).toMatchObject({
			draftKind: "response",
			generationReason: "trusted_constructive_content",
			voice: DEFAULT_DRAFT_VOICE,
		});
		expect(
			automatedDraftPolicy({
				classification: "at_risk",
				riskLevel: "medium",
			}),
		).toMatchObject({
			draftKind: "counter_argument",
			generationReason: "at_risk_page",
			voice: DEFAULT_DRAFT_VOICE,
		});
	});

	test("does not amplify ambiguous trusted-page content automatically", () => {
		expect(
			automatedDraftPolicy({
				classification: "trusted",
				riskLevel: "high",
				sentiment: "negative",
				stance: "opposed",
			}),
		).toBeNull();
	});
});

describe("Facebook page policy migration", () => {
	const migration = readFileSync("drizzle/0012_little_lenny_balinger.sql", "utf8");

	test("adds an observable idempotent queue protected by RLS", () => {
		expect(migration).toContain(
			"draft_automation_jobs_evidence_classification_unique",
		);
		expect(migration).toContain("counter_argument_drafts_automation_key_unique");
		expect(migration).toContain(
			'ALTER TABLE "public"."draft_automation_jobs" ENABLE ROW LEVEL SECURITY',
		);
		expect(migration).toContain(
			'REVOKE ALL ON TABLE "public"."facebook_page_profiles" FROM PUBLIC',
		);
	});
});
