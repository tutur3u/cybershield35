// Module-only declarations keep Workers globals out of the Next.js/browser type environment.
declare module "cloudflare:workers" {
 export const WorkflowEntrypoint: typeof import("@cloudflare/workers-types").CloudflareWorkersModule.WorkflowEntrypoint;
 export type WorkflowEvent<T> = import("@cloudflare/workers-types").CloudflareWorkersModule.WorkflowEvent<T>;
 export type WorkflowStep = import("@cloudflare/workers-types").CloudflareWorkersModule.WorkflowStep;
}
declare module "cloudflare:workflows" {
 export class NonRetryableError extends Error { constructor(message:string, name?:string); }
}
