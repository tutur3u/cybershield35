import { loadLocalEnvFile } from "@/lib/env/load-local-env";

loadLocalEnvFile();

const { removeHiddenZaloDrafts } = await import(
	"@/lib/workers/zalo-hidden-cleanup"
);

// `--apply` is required, so an accidental run only ever reports.
const apply = process.argv.includes("--apply");

try {
	const result = await removeHiddenZaloDrafts({ dryRun: !apply });
	console.log(
		JSON.stringify({
			apply,
			ok: true,
			task: "zalo:cleanup-hidden",
			...result,
			titles: undefined,
		}),
	);
	if (!apply) {
		console.log(
			`Dry run: ${result.scanned} bản ẩn sẽ được gỡ khỏi Zalo OA. Chạy lại với --apply để thực hiện.`,
		);
	}
} catch (error) {
	console.error(
		JSON.stringify({
			error: error instanceof Error ? error.message : "cleanup failed",
			ok: false,
			task: "zalo:cleanup-hidden",
		}),
	);
	process.exitCode = 1;
}

process.exit(process.exitCode ?? 0);
