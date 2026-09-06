import { describe, expect, test } from "bun:test";
import { parseApifyBillingCycle, providerCostTimestamp } from "@/lib/costs/account-cost";
const cycle = {dailyServiceUsages:[{date:"2026-07-01T00:00:00Z",totalUsageCreditsUsd:0.126},{date:"2026-07-02T00:00:00Z",totalUsageCreditsUsd:0.000001}], totalUsageCreditsUsdAfterVolumeDiscount:0.126001};
describe("Apify historical account totals", () => {
 test("serializes Drizzle raw timestamp strings for provider receipts", () => {
  expect(providerCostTimestamp("2026-09-06 11:35:50.123456+00")).toBe("2026-09-06T11:35:50.123Z");
  expect(providerCostTimestamp("2026-09-06 18:35:50.123+07")).toBe("2026-09-06T11:35:50.123Z");
  expect(() => providerCostTimestamp("invalid")).toThrow("Invalid provider cost timestamp");
 });
 test("retains per-event extras and fractional storage costs in reported daily totals", () => {
  expect([...parseApifyBillingCycle(cycle)]).toEqual([["2026-07-01",0.126],["2026-07-02",0.000001]]);
 });
 test("does not invent a distribution for monthly discounts", () => {
  expect(()=>parseApifyBillingCycle({...cycle,totalUsageCreditsUsdAfterVolumeDiscount:0.1})).toThrow("does not reconcile");
 });
 test("rejects incomplete, invalid and duplicate billing data", () => {
  for (const data of [null,{}, {...cycle,totalUsageCreditsUsdAfterVolumeDiscount:NaN}, {...cycle,dailyServiceUsages:[...cycle.dailyServiceUsages,cycle.dailyServiceUsages[0]]}, {...cycle,dailyServiceUsages:[{date:"bad",totalUsageCreditsUsd:0}]}, {...cycle,dailyServiceUsages:[{date:"2026-07-01",totalUsageCreditsUsd:-1}]}]) {
   expect(()=>parseApifyBillingCycle(data)).toThrow();
  }
 });
});
