import { utcTimestamp } from "./utc-timestamp.ts";
import { customType, text } from "drizzle-orm/sqlite-core";

/** The D1 snapshot stores UTC timestamps as ISO text, rather than epoch numbers. */
export const isoTimestamp = customType<{ data: Date; driverData: string }>({
	dataType: () => "text",
	toDriver: (value) => utcTimestamp(value),
	fromDriver: (value) => new Date(value),
});

/** SQLite CHECK constraints are defined in the migration; retain the TS union. */
export function sqliteEnum<const Values extends readonly [string, ...string[]]>(
	_name: string,
	values: Values,
) {
	return Object.assign((name: string) => text(name, { enum: values }), {
		enumValues: values,
	});
}
