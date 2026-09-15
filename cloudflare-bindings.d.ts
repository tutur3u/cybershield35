// Import binding types without replacing the browser/Next.js global fetch types.
type D1Database = import("@cloudflare/workers-types").D1Database;
type R2Bucket = import("@cloudflare/workers-types").R2Bucket;
type ImagesBinding = import("@cloudflare/workers-types").ImagesBinding;
type Fetcher = import("@cloudflare/workers-types").Fetcher;
type Service<
	T extends import("@cloudflare/workers-types").ExportedHandler =
		import("@cloudflare/workers-types").ExportedHandler,
> = import("@cloudflare/workers-types").Service<T>;
