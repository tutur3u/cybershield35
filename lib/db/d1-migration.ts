import { is, SQL } from "drizzle-orm";
import { getTableConfig, PgDialect, PgTable } from "drizzle-orm/pg-core";
import * as schema from "./schema.ts";

const dialect = new PgDialect();
const identifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

export const migrationTables = (Object.values(schema) as unknown[])
	.filter((value): value is PgTable => is(value, PgTable))
	.map(getTableConfig)
	.sort((a, b) => a.name.localeCompare(b.name));

/** D1 imports commit chunks: parent rows must exist before child-table chunks. */
export function orderedMigrationTables() {
	const pending = new Map(migrationTables.map((table) => [table.name, table]));
	const ordered: typeof migrationTables = [];
	while (pending.size) {
		const next = [...pending.values()].find((table) =>
			table.foreignKeys.every((key) => {
				const parent = getTableConfig(key.reference().foreignTable).name;
				return parent === table.name || !pending.has(parent);
			}),
		);
		if (!next)
			throw new Error(
				`Cyclic migration dependencies: ${[...pending.keys()].join(", ")}`,
			);
		ordered.push(next);
		pending.delete(next.name);
	}
	return ordered;
}

/** PostgreSQL enum keys sort by declaration order, not SQLite text order. */
export function d1SnapshotOrderBy(table: (typeof migrationTables)[number]) {
	return table.columns
		.filter((column) => column.primary)
		.map((column) =>
			column.enumValues
				? `CASE ${identifier(column.name)} ${column.enumValues.map((value, index) => `WHEN ${literal(value)} THEN ${index}`).join(" ")} END`
				: identifier(column.name),
		)
		.join(", ");
}

/** Lossless staging representation. Decimal amounts remain TEXT; never SQLite REAL. */
export function d1StorageType(pgType: string) {
	if (pgType === "integer" || pgType === "boolean") return "INTEGER";
	if (
		pgType === "text" ||
		pgType === "uuid" ||
		pgType === "date" ||
		pgType === "jsonb" ||
		pgType === "timestamp with time zone" ||
		pgType.startsWith("numeric(") ||
		pgType.startsWith("halfvec(")
	)
		return "TEXT";
	// Enums are handled by their column's enumValues below, with a CHECK constraint.
	throw new Error(`Unmapped PostgreSQL type: ${pgType}`);
}

export function createD1StagingSchema() {
	const statements: string[] = [
		"-- Staging schema only: application queries still require a native D1 port.",
	];
	const pendingIndexes: string[] = [];
	for (const table of migrationTables) {
		const columns = table.columns.map((column) => {
			const values = column.enumValues;
			let definition = `${identifier(column.name)} ${values ? "TEXT" : d1StorageType(column.getSQLType())}`;
			if (column.primary) definition += " PRIMARY KEY";
			if (column.notNull) definition += " NOT NULL";
			if (column.isUnique) definition += " UNIQUE";
			if (values)
				definition += ` CHECK (${identifier(column.name)} IN (${values.map(literal).join(", ")}))`;
			if (column.getSQLType() === "boolean")
				definition += ` CHECK (${identifier(column.name)} IN (0, 1))`;
			if (
				column.getSQLType() === "jsonb" ||
				column.getSQLType().startsWith("halfvec(")
			)
				definition += ` CHECK (json_valid(${identifier(column.name)}))`;
			if (column.default !== undefined) {
				const value = column.default;
				if (is(value, SQL)) {
					const expression = dialect.sqlToQuery(value).sql;
					if (expression === "now()")
						definition += " DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";
					// UUIDs must be assigned with crypto.randomUUID() by the native D1 writer.
					else if (expression !== "gen_random_uuid()")
						throw new Error(`Unmapped default: ${table.name}.${column.name}`);
				} else if (typeof value === "boolean")
					definition += ` DEFAULT ${value ? 1 : 0}`;
				else if (typeof value === "number") definition += ` DEFAULT ${value}`;
				else
					definition += ` DEFAULT ${literal(typeof value === "string" ? value : JSON.stringify(value))}`;
			}
			return definition;
		});
		for (const key of table.foreignKeys) {
			const ref = key.reference();
			columns.push(
				`FOREIGN KEY (${ref.columns.map((c) => identifier(c.name)).join(", ")}) REFERENCES ${identifier(getTableConfig(ref.foreignTable).name)} (${ref.foreignColumns.map((c) => identifier(c.name)).join(", ")}) ON DELETE ${key.onDelete ?? "no action"} ON UPDATE ${key.onUpdate ?? "no action"}`,
			);
		}
		for (const key of table.primaryKeys)
			columns.push(
				`PRIMARY KEY (${key.columns.map((c) => identifier(c.name)).join(", ")})`,
			);
		for (const key of table.uniqueConstraints)
			columns.push(
				`UNIQUE (${key.columns.map((c) => identifier(c.name)).join(", ")})`,
			);
		statements.push(
			`CREATE TABLE ${identifier(table.name)} (\n  ${columns.join(",\n  ")}\n);`,
		);
		for (const { config } of table.indexes) {
			// PostgreSQL search/vector/expression indexes need purpose-built replacements.
			if (
				(config.method && config.method !== "btree") ||
				config.columns.some((c) => is(c, SQL))
			)
				continue;
			const names = config.columns.map((c) =>
				identifier((c as { name: string }).name),
			);
			let where = config.where ? dialect.sqlToQuery(config.where).sql : "";
			where = where
				.replaceAll(`${identifier(table.name)}.`, "")
				.replace(/\btrue\b/g, "1")
				.replace(/\bfalse\b/g, "0");
			pendingIndexes.push(
				`CREATE ${config.unique ? "UNIQUE " : ""}INDEX ${identifier(config.name!)} ON ${identifier(table.name)} (${names.join(", ")})${where ? ` WHERE ${where}` : ""};`,
			);
		}
	}
	return [...statements, ...pendingIndexes].join("\n\n") + "\n";
}

export function encodeD1Value(
	pgType: string,
	value: unknown,
): string | number | null {
	if (value === null) return null;
	if (pgType === "boolean") return value ? 1 : 0;
	if (pgType === "integer") {
		const number = Number(value);
		if (!Number.isSafeInteger(number))
			throw new Error("Unsafe integer in migration");
		return number;
	}
	if (pgType === "timestamp with time zone") {
		const iso = new Date(value as string | Date).toISOString();
		const fraction =
			typeof value === "string"
				? value.match(/\.(\d+)(?:Z|[+-]\d{2}(?::?\d{2})?)$/)?.[1]
				: undefined;
		return fraction
			? iso.replace(/\.\d{3}Z$/, `.${fraction.padEnd(3, "0")}Z`)
			: iso;
	}
	if (pgType === "date")
		return value instanceof Date
			? value.toISOString().slice(0, 10)
			: String(value).slice(0, 10);
	if (pgType === "jsonb") return JSON.stringify(value);
	if (pgType.startsWith("halfvec(")) {
		const vector = typeof value === "string" ? JSON.parse(value) : value;
		if (
			!Array.isArray(vector) ||
			vector.length !== 768 ||
			!vector.every(Number.isFinite)
		)
			throw new Error("Invalid migration embedding");
		return JSON.stringify(vector);
	}
	return String(value);
}
