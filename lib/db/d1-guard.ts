import { sql, type SQL } from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import type { createD1Client } from "./d1-client";

/** First statement in a batch: abort the whole batch if its read snapshot changed. */
export function unchangedRow(db: ReturnType<typeof createD1Client>, table: AnySQLiteTable, condition: SQL) {
	return db.select({ guard: sql<number>`case when count(*) = 1 then 1 else abs(-9223372036854775808) end` })
		.from(table).where(condition);
}
