import { sql } from "drizzle-orm";
import { adminDb as db } from "@/lib/db/client";
const rowsOf = <T,>(r: unknown): T[] => {
	const m = r as { rows?: T[] };
	return Array.isArray(m.rows) ? m.rows : (r as T[]);
};
console.table(rowsOf(await db.execute(sql`
  select sentiment, stance, count(*)::int n from evidence_items group by 1,2 order by 3 desc limit 10`)));
console.table(rowsOf(await db.execute(sql`
  select coalesce(metadata->>'riskClassifier','-') classifier, count(*)::int n
  from evidence_items group by 1`)));
process.exit(0);
