import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

const config = defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
config.buildCommand =
	"bun run build && bun scripts/prepare-cloudflare-trace.ts";
export default config;
