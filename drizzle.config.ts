import { defineConfig } from "drizzle-kit";

import { loadLocalEnvFile } from "./lib/env/load-local-env";

loadLocalEnvFile();

export default defineConfig({
	schema: "./lib/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url:
			process.env.CS35_DATABASE_URL ??
			process.env.DATABASE_URL ??
			"postgres://cybershield:cybershield@localhost:5432/cybershield35",
	},
	verbose: true,
	strict: true,
});
