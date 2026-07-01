import { backfillIntelligenceRollups } from "@/lib/dashboard/intelligence-rollups";

try {
	await backfillIntelligenceRollups();
	console.log(
		JSON.stringify({
			ok: true,
			task: "db:backfill-intelligence",
			updatedAt: new Date().toISOString(),
		}),
	);
	process.exit(0);
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
	process.exit(1);
}
