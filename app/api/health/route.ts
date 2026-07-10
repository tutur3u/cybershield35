import { cacheLife, cacheTag } from "next/cache";

import { isTuturuuuAuthConfigured } from "@/lib/auth/tuturuuu-session";
import { DASHBOARD_HEALTH_TAG } from "@/lib/dashboard/cache-tags";
import { adminDb, checkDatabase } from "@/lib/db/client";
import { cronHeartbeats } from "@/lib/db/schema";
import { getProviderAvailability } from "@/lib/providers/availability";

export async function GET() {
	return Response.json(await getHealthSnapshot());
}

async function getHealthSnapshot() {
	"use cache";
	cacheLife({ stale: 60, revalidate: 60, expire: 300 });
	cacheTag(DASHBOARD_HEALTH_TAG);

	const providers = getProviderAvailability();
	const [databaseResult, cronResult] = await Promise.allSettled([
		checkDatabase(),
		adminDb.select().from(cronHeartbeats).limit(1),
	]);
	const database =
		databaseResult.status === "fulfilled"
			? databaseResult.value
			: {
					ok: false,
					error: errorMessage(databaseResult.reason, "Database unavailable"),
				};
	const cron =
		cronResult.status === "fulfilled"
			? {
					ok: cronResult.value.length > 0,
					lastSeenAt: cronResult.value[0]?.lastSeenAt?.toISOString(),
				}
			: {
					error: errorMessage(cronResult.reason, "Cron heartbeat unavailable"),
					ok: false,
				};

	return {
		status: database.ok ? "ok" : "degraded",
		database,
		cron,
		auth: {
			configured: isTuturuuuAuthConfigured(),
			provider: "tuturuuu-external-app",
		},
		providers,
	};
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}
