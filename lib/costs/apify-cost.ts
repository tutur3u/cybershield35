/** Apify totals already include billable events. Never add usageUsd again. */
export type ApifyCost = {
  amountUsd: number | null;
  currency: "USD";
  status: "pending" | "confirmed";
  observedAt: string;
  occurredAt: string | null;
  actorId: string | null;
  runStatus: string | null;
  source: "apify-api";
};

export function readApifyCost(run: {
  usageTotalUsd?: unknown;
  finishedAt?: Date | string | null;
  startedAt?: Date | string | null;
  actId?: string;
  status?: string;
}, now = new Date()): ApifyCost {
  const amount = run.usageTotalUsd;
  const finishedAt = run.finishedAt ? new Date(run.finishedAt) : null;
  const occurredAt = run.startedAt ? new Date(run.startedAt) : null;
  const terminal = ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(run.status ?? "");
  // Apify documents a ~10 second settlement delay after completion.
  const settled = terminal && finishedAt && Number.isFinite(finishedAt.getTime())
    && now.getTime() - finishedAt.getTime() >= 10_000;
  const validAmount = typeof amount === "number" && Number.isFinite(amount) && amount >= 0;
  return {
    amountUsd: validAmount ? amount : null,
    currency: "USD",
    status: settled && validAmount ? "confirmed" : "pending",
    observedAt: now.toISOString(),
    occurredAt: occurredAt && Number.isFinite(occurredAt.getTime()) ? occurredAt.toISOString() : null,
    actorId: run.actId ?? null,
    runStatus: run.status ?? null,
    source: "apify-api",
  };
}

export function isConfirmedApifyCost(value: unknown): value is ApifyCost & { amountUsd: number; occurredAt: string } {
  if (!value || typeof value !== "object") return false;
  const cost = value as ApifyCost;
  return cost.source === "apify-api" && cost.currency === "USD" && cost.status === "confirmed"
    && typeof cost.amountUsd === "number" && Number.isFinite(cost.amountUsd) && cost.amountUsd >= 0
    && typeof cost.occurredAt === "string" && Number.isFinite(Date.parse(cost.occurredAt));
}
