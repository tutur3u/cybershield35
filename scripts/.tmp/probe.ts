import { sql } from "drizzle-orm";
import { adminDb as db } from "@/lib/db/client";
const rowsOf = <T,>(r: unknown): T[] => {
	const m = r as { rows?: T[] };
	return Array.isArray(m.rows) ? m.rows : (r as T[]);
};
const [v] = rowsOf<{ judged: number; total: number }>(await db.execute(sql`
  select count(*) filter (where coalesce((metadata->>'classifierVersion')::int,0) >= 2)::int judged,
         count(*)::int total from evidence_items`));
console.log(`judged ${v.judged}/${v.total}`);
console.table(rowsOf(await db.execute(sql`
  select sentiment, count(*)::int n from evidence_items group by 1 order by 2 desc`)));
console.table(rowsOf(await db.execute(sql`
  select stance, count(*)::int n from evidence_items group by 1 order by 2 desc`)));
process.exit(0);
