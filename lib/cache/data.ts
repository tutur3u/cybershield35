import "server-only";
import { unstable_cache } from "next/cache";
import { deserializeCachedData, serializeCachedData } from "./codec";

/** Use OpenNext's persisted data cache without cross-request React stream state. */
export async function cachedData<T>(key: string, args: unknown[], options: {revalidate: number; tags: string[]}, load: () => Promise<T>): Promise<T> {
 const read = unstable_cache(async () => serializeCachedData(await load()), ["cs35-data-v1", key, serializeCachedData(args)], options);
 return deserializeCachedData<T>(await read());
}
