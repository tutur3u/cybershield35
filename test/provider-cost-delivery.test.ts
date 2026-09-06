import { describe, expect, test } from "bun:test";
import { readApifyCost } from "@/lib/costs/apify-cost";
import { deliverProviderCost } from "@/lib/costs/delivery";
const input = { cost: readApifyCost({ usageTotalUsd: 0.126, status: "SUCCEEDED", startedAt: "2026-07-01", finishedAt: "2026-07-02" }, new Date("2026-09-01")), runId: "run1", service: "apify_facebook_posts", token: "test-only", workspace: "test-workspace", baseUrl: "https://ai.tuturuuu.com/v1/" };
describe("provider-cost delivery", () => {
  test("sends stable identity and historical attribution without inflating amounts", async () => {
    const fetchImpl = (async (url, options) => {
      expect(String(url)).toBe("https://ai.tuturuuu.com/v1/provider-costs");
      const body = JSON.parse(String(options?.body));
      expect(body.externalRunId).toBe("run1");
      expect(body.amountUsd).toBe(0.126);
      expect(body.occurredAt).toBe("2026-07-01T00:00:00.000Z");
      expect(body).not.toHaveProperty("workspaceId");
      return Response.json({ accepted: true, externalRunId: "run1" });
    }) as typeof fetch;
    expect(await deliverProviderCost({...input, fetchImpl})).toBe("accepted");
  });
  test("requires an explicit matching receipt before marking synchronized", async () => {
    for (const body of [{}, {accepted: true, externalRunId: "other"}, {accepted: false, externalRunId: "run1"}]) {
      expect(await deliverProviderCost({...input, fetchImpl: (async () => Response.json(body)) as typeof fetch})).toBe("invalid_receipt");
    }
    expect(await deliverProviderCost({...input, fetchImpl: (async () => new Response("unavailable",{status:503})) as typeof fetch})).toBe("upstream_503");
  });
  test("never uploads preliminary costs", async () => {
    expect(await deliverProviderCost({...input, cost:{...input.cost,status:"pending"}, fetchImpl: (()=>{throw new Error("must not call")}) as typeof fetch})).toBe("unconfirmed");
  });
});
