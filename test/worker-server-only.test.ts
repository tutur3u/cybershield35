import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("worker server-only runtime", () => {
	test("runs the standalone worker with the react-server condition", () => {
		const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
			scripts?: Record<string, string>;
		};

		expect(packageJson.scripts?.worker).toContain("--conditions react-server");
	});
});
