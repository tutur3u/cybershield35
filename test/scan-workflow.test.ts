import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("scans run as a durable workflow", () => {
	const workflow = read("workflows/scan-pipeline.ts");
	const stages = read("lib/workers/scan-stages.ts");
	const scans = read("lib/workers/scans.ts");
	const vercel = JSON.parse(read("vercel.json"));
	const nextConfig = read("next.config.ts");

	test("every stage of the pipeline is its own durable step", () => {
		expect(workflow).toContain('"use workflow"');
		// The pipeline's shape, in order. A stage that is not a step shares the
		// budget and the failure of whatever step it was folded into.
		for (const step of [
			"claimStep",
			"collectStep",
			"riskStep",
			"analysisStep",
			"topicsStep",
			"completeStep",
			"failStep",
		]) {
			expect(workflow).toContain(`async function ${step}(`);
		}
		expect(workflow.match(/"use step"/g)?.length).toBeGreaterThanOrEqual(7);
	});

	test("stages carry ids, not payloads", () => {
		// A step boundary only carries what can be written down. Passing the
		// provider's output between steps would put the whole crawl in the event
		// log; every stage reads what it needs from the database instead.
		expect(stages).toContain("export async function scoreEvidenceRisk(scanJobId: string)");
		expect(stages).toContain("export async function analyzeScan(scanJobId: string)");
		expect(stages).toContain("export async function syncScanTopics(scanJobId: string)");
		expect(workflow).toContain("await riskStep(job.id)");
		expect(workflow).toContain("await analysisStep(job.id)");
	});

	test("a terminal provider fault does not spend the retry budget", () => {
		// Retrying an exhausted account quota cannot succeed, and leaves every
		// scan in a state that reads like recovery in progress.
		expect(workflow).toContain("if (!isRetryableCollectionError(error))");
		expect(workflow).toContain("throw new FatalError(");
		expect(workflow).toContain("retryable: !(error instanceof FatalError)");
		// The decision is passed as a flag, because an error does not survive the
		// step boundary intact.
		expect(stages).toContain("retryable?: boolean;");
		expect(stages).toContain(
			"const retryable = input.retryable ?? isRetryableCollectionError(input.error);",
		);
	});

	test("a workflow that cannot start degrades to the old path", () => {
		// A problem with the workflow platform must not stop scanning.
		expect(scans).toContain("const started = await startScanPipelineRun(claimed);");
		expect(scans).toContain("return processClaimedJobInline(claimed);");
		expect(scans).toContain("scan_run_fallback");
	});

	test("the queue is bounded so a drain cannot stampede the provider", () => {
		// Inline processing was self-limiting; a durable run returns as soon as it
		// starts, so without a cap one drain fires every queued scan at once.
		expect(scans).toContain("export const MAX_CONCURRENT_SCAN_RUNS");
		expect(scans).toContain("export async function scanCapacityRemaining()");
		const scheduler = read("lib/managed-scheduler/server.ts");
		expect(scheduler).toContain("await scanCapacityRemaining()");
		// A capped queue needs a regular tick, or the remainder waits a full day.
		expect(scheduler).toContain("const scans = await drainScanQueue();");
	});

	test("the build compiles workflows and the step route has room to work", () => {
		expect(nextConfig).toContain("withWorkflow(nextConfig)");
		expect(
			vercel.functions["app/.well-known/workflow/v1/step/route.js"].maxDuration,
		).toBe(300);
	});
});
