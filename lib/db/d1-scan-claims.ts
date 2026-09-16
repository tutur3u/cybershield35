import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type { createD1Client } from "./d1-client.ts";
import { scanJobs } from "./schema.d1.ts";

/** One UPDATE owns selection and transition; no SELECT-then-UPDATE race. */
export async function claimD1Scan(
	db: ReturnType<typeof createD1Client>,
	options: { scanId?: string; now?: Date } = {},
) {
	const now = options.now ?? new Date();
	const queued = inArray(scanJobs.status, ["queued", "retrying"]);
	const candidate = db.select({ id: scanJobs.id }).from(scanJobs)
		.where(and(queued, lte(scanJobs.scheduledAt, now)))
		.orderBy(desc(scanJobs.priority), asc(scanJobs.scheduledAt), asc(scanJobs.id))
		.limit(1);
	const [job] = await db.update(scanJobs).set({
		status: "running",
		lockedAt: now,
		startedAt: sql`coalesce(${scanJobs.startedAt}, ${now.toISOString()})`,
		attempts: sql`${scanJobs.attempts} + 1`,
		updatedAt: now,
	}).where(and(queued, options.scanId
		? eq(scanJobs.id, options.scanId)
		: inArray(scanJobs.id, candidate)))
		.returning({id: scanJobs.id, source_id: scanJobs.sourceId, provider: scanJobs.provider,
			attempts: scanJobs.attempts, max_attempts: scanJobs.maxAttempts});
	return job ?? null;
}
