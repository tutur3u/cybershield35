import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const fallbackUrl =
	"postgres://cybershield:cybershield@localhost:5432/cybershield35";

export const databaseUrl = process.env.DATABASE_URL ?? fallbackUrl;

const globalForDb = globalThis as unknown as {
	cybershieldSql?: postgres.Sql;
};

export const sqlClient =
	globalForDb.cybershieldSql ??
	postgres(databaseUrl, {
		max: Number(process.env.DB_POOL_SIZE ?? 5),
		prepare: false,
		idle_timeout: 20,
		connect_timeout: 8,
	});

if (process.env.NODE_ENV !== "production") {
	globalForDb.cybershieldSql = sqlClient;
}

export const db = drizzle(sqlClient, { schema });

export async function checkDatabase() {
	const started = Date.now();
	await sqlClient`select 1 as ok`;
	return { ok: true, latencyMs: Date.now() - started };
}
