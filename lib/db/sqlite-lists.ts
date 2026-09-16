import { sql, type SQLWrapper } from "drizzle-orm";

/** One bind parameter for arbitrary list sizes, below D1's per-query limit. */
export function inJsonArray(column: SQLWrapper, values: readonly string[]) {
 return sql`${column} in (select value from json_each(${JSON.stringify(values)}))`;
}
