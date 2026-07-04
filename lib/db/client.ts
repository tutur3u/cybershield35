import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const fallbackUrl =
	"postgres://cybershield:cybershield@localhost:5432/cybershield35";

export const adminDatabaseUrl =
	firstConfiguredEnv(
		"CS35_DATABASE_URL",
		"POSTGRES_URL",
		"POSTGRES_PRISMA_URL",
		"DATABASE_URL",
	) ?? fallbackUrl;

const globalForDb = globalThis as unknown as {
	cybershieldAdminSql?: postgres.Sql;
};

export const adminSqlClient =
	globalForDb.cybershieldAdminSql ??
	postgres(adminDatabaseUrl, {
		max: Number(process.env.DB_POOL_SIZE ?? 5),
		prepare: false,
		idle_timeout: 20,
		connect_timeout: Number(process.env.DB_CONNECT_TIMEOUT ?? 15),
	});

if (process.env.NODE_ENV !== "production") {
	globalForDb.cybershieldAdminSql = adminSqlClient;
}

export const adminDb = drizzle(adminSqlClient, { schema });

export async function checkDatabase() {
	const started = Date.now();
	await adminSqlClient`select 1 as ok`;
	return { ok: true, latencyMs: Date.now() - started };
}

function firstConfiguredEnv(...names: string[]) {
	for (const name of names) {
		const value = process.env[name]?.trim();
		if (value) return value;
	}
	return null;
}
