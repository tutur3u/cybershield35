import { AsyncLocalStorage } from "node:async_hooks";
import type { D1Database } from "@cloudflare/workers-types";

// Maintenance commands provide an explicit binding; HTTP requests use OpenNext.
export const maintenanceDatabase = new AsyncLocalStorage<D1Database>();
