import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

import d1TagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

const config = defineCloudflareConfig({ incrementalCache: r2IncrementalCache, tagCache: d1TagCache, queue: doQueue });
config.buildCommand =
	"bun run build && bun scripts/prepare-cloudflare-trace.ts";
export default config;
