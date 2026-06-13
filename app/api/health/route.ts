import { checkDatabase, db } from "@/lib/db/client";
import { cronHeartbeats } from "@/lib/db/schema";
import { getProviderAvailability } from "@/lib/providers";
import { isTuturuuuAuthConfigured } from "@/lib/auth/tuturuuu-session";

export const runtime = "nodejs";

export async function GET() {
	const providers = getProviderAvailability();
	let database: { ok: boolean; latencyMs?: number; error?: string };
	let cron: { ok: boolean; lastSeenAt?: string; error?: string } = { ok: false };

	try {
		database = await checkDatabase();
		const rows = await db.select().from(cronHeartbeats).limit(1);
		cron = {
			ok: rows.length > 0,
			lastSeenAt: rows[0]?.lastSeenAt?.toISOString(),
		};
	} catch (error) {
		database = {
			ok: false,
			error: error instanceof Error ? error.message : "Database unavailable",
		};
	}

	return Response.json({
		status: database.ok ? "ok" : "degraded",
		database,
		cron,
		auth: {
			configured: isTuturuuuAuthConfigured(),
			provider: "tuturuuu-external-app",
		},
		providers,
	});
}
