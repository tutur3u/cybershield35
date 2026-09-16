import { defineConfig } from "drizzle-kit";

// Generate reviewed SQLite migration proposals. Apply through Wrangler/D1.
export default defineConfig({
 schema: "./lib/db/schema.d1.ts",
 out: "./drizzle-d1-generated",
 dialect: "sqlite",
 verbose: true,
 strict: true,
});
