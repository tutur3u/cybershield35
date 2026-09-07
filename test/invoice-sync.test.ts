import { describe, expect, it } from "bun:test";
import { syncBillingInvoices } from "../lib/costs/invoice-sync";

const invoice = { provider: "neon" as const, reference: "test-invoice", issuedOn: "2026-01-01", reviewedOn: "2026-01-02", amountUsd: 1.25, currency: "USD" as const, status: "paid" as const };
const input = { token: "test-token", workspace: "test-workspace", baseUrl: "https://ai.tuturuuu.com/v1/", invoices: [invoice] };
describe("invoice delivery", () => {
  it("sends reviewed provenance and validates the retained receipt", async () => {
    const result = await syncBillingInvoices({ ...input, fetchImpl: (async (url, init) => {
      expect(url).toBe("https://ai.tuturuuu.com/v1/provider-invoices");
      expect(JSON.parse(String(init?.body))).toEqual({ ...invoice, accountId: "cs35-dedicated", source: "reviewed_provider_invoice" });
      return Response.json({ accepted: true, reference: invoice.reference });
    }) });
    expect(result).toEqual({ synced: 1, status: "ready" });
  });
  it("does not acknowledge another invoice or a conflicting snapshot", async () => {
    expect(await syncBillingInvoices({ ...input, fetchImpl: (async () => Response.json({ accepted: true, reference: "other" })) })).toEqual({ synced: 0, status: "invoice_invalid_receipt" });
    expect(await syncBillingInvoices({ ...input, fetchImpl: (async () => new Response(null, { status: 409 })) })).toEqual({ synced: 0, status: "invoice_upstream_409" });
  });
  it("reports network failure without leaking credentials or claiming sync", async () => {
    expect(await syncBillingInvoices({ ...input, fetchImpl: (async () => { throw new Error("network"); }) })).toEqual({ synced: 0, status: "invoice_network_error" });
  });
});
