import { describe, expect, test } from "bun:test";
import { parseApifyBillingCycle } from "@/lib/costs/account-cost";
const cycle = {dailyServiceUsages:[{date:"2026-07-01T00:00:00Z",totalUsageCreditsUsd:0.126},{date:"2026-07-02T00:00:00Z",totalUsageCreditsUsd:0.000001}], totalUsageCreditsUsdAfterVolumeDiscount:0.126001};
describe("Apify historical account totals", () => {
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
