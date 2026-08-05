import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * `window.confirm` blocks the main thread, cannot be styled or translated, and
 * cannot be exercised by a browser test. Every confirmation is the product's
 * own dialog instead.
 */
const SOURCE_ROOTS = ["app", "components", "lib"];

function sourceFiles() {
	const files: string[] = [];
	const walk = (directory: string) => {
		for (const entry of readdirSync(directory)) {
			if (entry === "node_modules" || entry.startsWith(".")) continue;
			const path = join(directory, entry);
			if (statSync(path).isDirectory()) {
				walk(path);
				continue;
			}
			if (/\.(ts|tsx)$/u.test(entry)) files.push(path);
		}
	};
	for (const root of SOURCE_ROOTS) walk(root);
	return files;
}

describe("confirmations use the product's dialog", () => {
	test("no source file calls a native browser dialog", () => {
		const offenders: string[] = [];
		for (const file of sourceFiles()) {
			const contents = readFileSync(file, "utf8");
			for (const [index, line] of contents.split("\n").entries()) {
				// Prose in a comment explaining why we avoid it is not a call.
				const code = line.replace(/\/\/.*$/u, "").replace(/^\s*\*.*$/u, "");
				if (/\bwindow\.(confirm|alert|prompt)\s*\(/u.test(code)) {
					offenders.push(`${file}:${index + 1}`);
				}
			}
		}
		expect(offenders).toEqual([]);
	});

	test("the dialog resolves rather than leaving callers hanging", () => {
		const source = readFileSync(
			"components/dashboard/confirm-dialog.tsx",
			"utf8",
		);
		// Dismissing by escape or backdrop must settle as a "no", never silently.
		expect(source).toContain("if (!open) settle(false);");
		expect(source).toContain("pendingRef.current?.resolve(value);");
	});
});
