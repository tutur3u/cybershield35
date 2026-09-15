import { cp, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Next traces the CJS telemetry entrypoint, but OpenNext bundles its ESM entrypoint.
// Extend only generated middleware build artifacts; dependency sources stay intact.
const tracePath = ".next/server/middleware.js.nft.json";
const trace = JSON.parse(await readFile(tracePath, "utf8")) as {
	version: number;
	files: string[];
};
const additions: string[] = [];
for (const traced of trace.files.filter(
	(file) =>
		file.endsWith("/@opentelemetry/api/package.json") &&
		!file.includes("/next/dist/compiled/"),
)) {
	const relativeDirectory = path.dirname(traced);
	const source = path.resolve(".next/server", relativeDirectory);
	const destination = path.resolve(
		".next/standalone/.next/server",
		relativeDirectory,
	);
	await cp(
		path.join(source, "build/esm"),
		path.join(destination, "build/esm"),
		{ recursive: true },
	);
	for (const entry of await readdir(path.join(source, "build/esm"), {
		recursive: true,
		withFileTypes: true,
	})) {
		if (!entry.isFile()) continue;
		const full = path.join(entry.parentPath, entry.name);
		additions.push(path.relative(path.resolve(".next/server"), full));
	}
}
trace.files = [...new Set([...trace.files, ...additions])];
await writeFile(tracePath, JSON.stringify(trace));
console.log(
	`Included ${additions.length} ESM telemetry files in the Cloudflare middleware trace.`,
);
