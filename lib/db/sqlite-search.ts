import { sql, type SQLWrapper } from "drizzle-orm";

// SQLite lower() handles ASCII. Fold Vietnamese letters explicitly as well.
// These are fixed SQL literals; user input is always a bound parameter.
const vietnameseUpper = "ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ";

/** Literal substring search, including long text and SQL wildcard characters. */
export function containsInsensitive(column: SQLWrapper, query: string) {
 let folded = sql`lower(${column})`;
 for (const upper of vietnameseUpper) {
  folded = sql`replace(${folded}, ${sql.raw(`'${upper}'`)}, ${sql.raw(`'${upper.toLowerCase()}'`)})`;
 }
 return sql`instr(${folded}, ${query.toLowerCase()}) > 0`;
}
