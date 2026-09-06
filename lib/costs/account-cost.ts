/** Normalize the provider's daily totals without allocating unknown discounts. */
export function parseApifyBillingCycle(data: unknown) {
  if (!data || typeof data !== "object") throw new Error("Billing cycle unavailable");
  const cycle = data as { dailyServiceUsages?: unknown; totalUsageCreditsUsdAfterVolumeDiscount?: unknown };
  if (!Array.isArray(cycle.dailyServiceUsages) || typeof cycle.totalUsageCreditsUsdAfterVolumeDiscount !== "number"
    || !Number.isFinite(cycle.totalUsageCreditsUsdAfterVolumeDiscount)) throw new Error("Daily billing unavailable");
  const daily = new Map<string, number>();
  for (const item of cycle.dailyServiceUsages) {
    const day = item as { date?: unknown; totalUsageCreditsUsd?: unknown };
    const date = typeof day?.date === "string" ? day.date.slice(0,10) : "";
    const amount = day?.totalUsageCreditsUsd;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || daily.has(date)
      || typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) throw new Error("Invalid daily billing record");
    daily.set(date, amount);
  }
  const total = [...daily.values()].reduce((sum, amount) => sum + amount, 0);
  if (Math.abs(total - cycle.totalUsageCreditsUsdAfterVolumeDiscount) > 0.000001) {
    throw new Error("Daily usage does not reconcile with discounted billing total");
  }
  return daily;
}
/** postgres-js timestamps are strings after Drizzle installs its parsers. */
export function providerCostTimestamp(value: string) {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) throw new Error("Invalid provider cost timestamp");
  return timestamp.toISOString();
}
