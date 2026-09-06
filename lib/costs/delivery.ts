import { type ApifyCost, isConfirmedApifyCost } from "./apify-cost";

export async function deliverProviderCost(input: {
  cost: ApifyCost;
  runId: string;
  service: string;
  token: string;
  workspace: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}) {
  if (!isConfirmedApifyCost(input.cost)) return "unconfirmed";
  const response = await (input.fetchImpl ?? fetch)(`${input.baseUrl.replace(/\/+$/, "")}/provider-costs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json", "X-Tuturuuu-Workspace-Id": input.workspace },
    body: JSON.stringify({ provider: "apify", externalRunId: input.runId, service: input.service,
      amountUsd: input.cost.amountUsd, currency: "USD", occurredAt: input.cost.occurredAt,
      observedAt: input.cost.observedAt, source: "provider_api" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return `upstream_${response.status}`;
  const receipt = await response.json().catch(() => null);
  return receipt?.accepted === true && receipt?.externalRunId === input.runId ? "accepted" : "invalid_receipt";
}
