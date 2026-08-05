import { loadLocalEnvFile } from "@/lib/env/load-local-env";

loadLocalEnvFile();

const { adminSqlClient } = await import("@/lib/db/client");
const { regenerateArticleHeadlines } = await import(
	"@/lib/workers/article-headlines"
);

const args = new Set(process.argv.slice(2));
const limitArg = process.argv.slice(2).find((value) => /^\d+$/u.test(value));

try {
	const result = await regenerateArticleHeadlines({
		// `--force` rewrites every title, not just the ones that read as clipped.
		force: args.has("--force"),
		// Live articles stay untouched unless explicitly included, so a bulk pass
		// never changes what Zalo followers are already reading.
		includePublished: args.has("--include-published"),
		limit: limitArg ? Number(limitArg) : undefined,
	});
	console.log(
		JSON.stringify({
			ok: true,
			task: "db:regenerate-headlines",
			updatedAt: new Date().toISOString(),
			...result,
		}),
	);
} catch (error) {
	console.error(
		JSON.stringify({
			error:
				error instanceof Error
					? error.message
					: "Failed to regenerate article headlines.",
			ok: false,
			task: "db:regenerate-headlines",
		}),
	);
	process.exitCode = 1;
} finally {
	await adminSqlClient.end({ timeout: 5 });
}
