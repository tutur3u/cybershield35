type Step = { stage: string; run: () => Promise<unknown> };
type Result = { stage: string; status: string; synced?: number; errorType?: string; errorCode?: string };

/** A billing API outage must not prevent delivery of already verified costs. */
export async function runCostMaintenance(steps: Step[], report: (result: Result) => void) {
  for (const step of steps) {
    try {
      const result = await step.run();
      const data = result && typeof result === "object" ? result as Record<string, unknown> : {};
      report({ stage: step.stage, status: typeof data.status === "string" ? data.status : "completed",
        synced: typeof data.synced === "number" ? data.synced : undefined });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      report({ stage: step.stage, status: "pending", errorType: error instanceof Error ? error.name : "UnknownError",
        errorCode: typeof code === "string" && /^[A-Z0-9_]{1,64}$/.test(code) ? code : undefined });
    }
  }
}
