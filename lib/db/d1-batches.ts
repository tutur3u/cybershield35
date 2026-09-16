import { getTableColumns } from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";

/** Include defaulted columns when budgeting D1's 100 bound parameters. */
export function chunkForD1<T>(table: AnySQLiteTable, rows: T[], reservedParameters = 0): [T, ...T[]][] {
 const size=Math.max(1,Math.floor((100-reservedParameters)/Object.keys(getTableColumns(table)).length));
 const chunks: [T,...T[]][]=[];
 for(let offset=0;offset<rows.length;offset+=size) chunks.push(rows.slice(offset,offset+size) as [T,...T[]]);
 return chunks;
}
