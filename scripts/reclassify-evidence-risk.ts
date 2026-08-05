import { loadLocalEnvFile } from "@/lib/env/load-local-env";

loadLocalEnvFile();

const { adminSqlClient } = await import("@/lib/db/client");
const { reassessStoredEvidenceRisk } = await import(
	"@/lib/workers/evidence-risk"
);

const limit = Number(process.argv[2] ?? "5000");

try {
	const result = await reassessStoredEvidenceRisk(
		Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5_000,
	);
	console.log(
		JSON.stringify({
			ok: true,
			task: "db:reclassify-risk",
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
					: "Failed to reclassify evidence risk.",
			ok: false,
			task: "db:reclassify-risk",
		}),
	);
	process.exitCode = 1;
} finally {
	await adminSqlClient.end({ timeout: 5 });
}
