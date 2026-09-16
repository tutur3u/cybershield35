import r2Cache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

/** A slow upload must not make pre-mutation data appear newer than invalidation. */
export function withGenerationTime(adapter: Pick<typeof r2Cache, "get" | "set" | "delete">) {
 return {
  name: r2Cache.name,
  get: (async (...args: Parameters<typeof r2Cache.get>) => {
   const entry = await adapter.get(...args);
   if (!entry) return null;
   const generatedAt = (entry.value as { __cs35GeneratedAt?: number }).__cs35GeneratedAt;
   return {...entry, lastModified: generatedAt ?? entry.lastModified};
  }) as typeof r2Cache.get,
  set: (async (...args: Parameters<typeof r2Cache.set>) => {
   const [key, value, kind] = args;
   const stampedValue = {...value, __cs35GeneratedAt: Date.now()};
   await adapter.set(key, stampedValue, kind);
  }) as typeof r2Cache.set,
  delete: adapter.delete.bind(adapter),
 };
}

export default withGenerationTime(r2Cache);
