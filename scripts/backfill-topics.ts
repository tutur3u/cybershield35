import { loadLocalEnvFile } from "@/lib/env/load-local-env";

export async function run() {

loadLocalEnvFile();

const { adminSqlClient } = await import("@/lib/db/client");
const { backfillTopicsFromAnalyses } = await import("@/lib/workers/topics");

async function main() {
	const summary = await backfillTopicsFromAnalyses();
	console.log(
		JSON.stringify({
			...summary,
			ts: new Date().toISOString(),
		}),
	);
}

await main()
	.catch((error) => {
		console.error(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Topic backfill failed",
			}),
		);
		process.exitCode = 1;
	})
	.finally(async () => {
		await adminSqlClient.end({ timeout: 5 });
	});

}
