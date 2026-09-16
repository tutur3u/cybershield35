import { utcTimestamp } from "./utc-timestamp.ts";
import type { D1Database } from "@cloudflare/workers-types";
import { is, SQL } from "drizzle-orm";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";

type Row = Record<string, unknown>;

/** Parameterized SQLite fragments. This does not translate PostgreSQL SQL. */
export class D1Query<T extends Row[] = Row[]> implements PromiseLike<T> {
	constructor(readonly text: string, readonly values: unknown[], private binding: () => D1Database) {}
	prepare() { return this.binding().prepare(this.text).bind(...this.values); }
	async execute(): Promise<T> {
		const result = await this.prepare().all<T[number]>();
		// JSON aggregates and stored JSON columns have explicit, stable result names.
		for (const row of result.results) {
			for (const key of ["output", "metadata", "engagement", "evidence_ids", "evidence_risks", "source_labels", "topic_slugs", "topics"]) {
				const value = row[key];
				if (typeof value === "string" && /^[\[{]/.test(value)) (row as Row)[key] = JSON.parse(value);
			}
		}
		return result.results as T;
	}
	then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): PromiseLike<TResult1 | TResult2> {
		return this.execute().then(onfulfilled, onrejected);
	}
}

export function createD1Sql(binding: () => D1Database) {
	function query<T extends Row[] = Row[]>(parts: TemplateStringsArray, ...parameters: unknown[]) {
		let text = parts[0] ?? "";
		const values: unknown[] = [];
		for (let i = 0; i < parameters.length; i++) {
			const value = parameters[i];
			if (value instanceof D1Query) { text += value.text; values.push(...value.values); }
			else if (is(value, SQL)) {
				const fragment = new SQLiteAsyncDialect().sqlToQuery(value);
				text += fragment.sql; values.push(...fragment.params);
			}
			else {
				text += "?";
				values.push(value instanceof Date ? utcTimestamp(value) : typeof value === "boolean" ? Number(value) : value);
			}
			text += parts[i + 1] ?? "";
		}
		return new D1Query<T>(text, values, binding);
	}
	return Object.assign(query, {
		fromQuery: (query: { sql: string; params: unknown[] }) => new D1Query(query.sql, query.params, binding),
		batch: (queries: D1Query[]) => binding().batch(queries.map((item) => item.prepare())),
		end: async (options?: { timeout?: number }) => { void options; },
	});
}
