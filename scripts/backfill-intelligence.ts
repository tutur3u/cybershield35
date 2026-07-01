import { loadLocalEnvFile } from "@/lib/env/load-local-env";

loadLocalEnvFile();

const { adminSqlClient } = await import("@/lib/db/client");
const { backfillIntelligenceRollups } = await import(
	"@/lib/dashboard/intelligence-rollups"
);

try {
	await backfillIntelligenceRollups();
	console.log(
		JSON.stringify({
			ok: true,
			task: "db:backfill-intelligence",
			updatedAt: new Date().toISOString(),
		}),
	);
} catch (error) {
	console.error(
		JSON.stringify({
			error:
				error instanceof Error
					? error.message
					: "Failed to backfill intelligence rollups.",
			ok: false,
			task: "db:backfill-intelligence",
		}),
	);
	process.exitCode = 1;
} finally {
	await adminSqlClient.end({ timeout: 5 });
}
