import { sql } from "drizzle-orm";
import { adminDb as db } from "@/lib/db/client";
const rowsOf = <T,>(r: unknown): T[] => {
	const m = r as { rows?: T[] };
	return Array.isArray(m.rows) ? m.rows : (r as T[]);
};
const [v] = rowsOf<{ ours: number; foreign: number }>(await db.execute(sql`
  select count(*) filter (where cover_url like 'https://cybershield35.ttr.gg/%')::int ours,
         count(*) filter (where cover_url is not null and cover_url <> ''
           and cover_url not like 'https://cybershield35.ttr.gg/%')::int foreign
  from articles`));
console.log(`covers on our origin: ${v.ours} | still foreign: ${v.foreign}`);
process.exit(0);
