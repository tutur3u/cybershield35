import { parseBillingInvoices, type BillingInvoice } from "./invoices";

/** Tuturuuu retains immutable receipts; retries never add another charge. */
export async function syncBillingInvoices(input: {
	token: string;
	workspace: string;
	baseUrl: string;
	invoices?: BillingInvoice[];
	fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
}) {
	let invoices: BillingInvoice[];
	try {
		invoices = input.invoices ?? parseBillingInvoices(process.env.CS35_BILLING_INVOICES_JSON);
	} catch {
		return { synced: 0, status: "invoice_config_invalid" };
	}
	let synced = 0;
	for (const invoice of invoices) {
		try {
			const response = await (input.fetchImpl ?? fetch)(`${input.baseUrl.replace(/\/+$/, "")}/provider-invoices`, {
				method: "POST",
				headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json", "X-Tuturuuu-Workspace-Id": input.workspace },
				body: JSON.stringify({ ...invoice, accountId: "cs35-dedicated", source: "reviewed_provider_invoice" }),
				signal: AbortSignal.timeout(15_000),
			});
			if (!response.ok) return { synced, status: `invoice_upstream_${response.status}` };
			const receipt = await response.json().catch(() => null);
			if (receipt?.accepted !== true || receipt.reference !== invoice.reference)
				return { synced, status: "invoice_invalid_receipt" };
			synced++;
		} catch {
			return { synced, status: "invoice_network_error" };
		}
	}
	return { synced, status: "ready" };
}
