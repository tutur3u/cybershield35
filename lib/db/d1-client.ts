import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "./schema.d1.ts";

/** Pass a request's native binding; never keep a request-scoped client globally. */
export function createD1Client(binding: D1Database) {
	return drizzle(binding, { schema });
}
