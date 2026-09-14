import { expect, test } from "bun:test";

test("smart draft route saves complete articles and never persists failed generations", () => {
	const result = Bun.spawnSync(
		[
			process.execPath,
			"test",
			"./test/fixtures/evidence-article-generation.cases.ts",
		],
		{
			cwd: process.cwd(),
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0);
});

test("the actual SDK repairs malformed article blocks from the provider", () => {
	const result = Bun.spawnSync(
		[
			process.execPath,
			"test",
			"./test/fixtures/article-provider-contract.cases.ts",
		],
		{
			cwd: process.cwd(),
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0);
});
