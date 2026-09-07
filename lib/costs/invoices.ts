import { z } from "zod";

const invoiceSchema = z
	.object({
		provider: z.enum(["neon", "firecrawl"]),
		reference: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
		issuedOn: z.iso.date(),
		amountUsd: z.number().finite().nonnegative(),
		currency: z.literal("USD"),
		status: z.literal("paid"),
		reviewedOn: z.iso.date(),
	})
	.strict();
export type BillingInvoice = z.infer<typeof invoiceSchema>;

/** Reviewed private invoice snapshots; never masquerade as provider API usage. */
export function parseBillingInvoices(
	raw: string | undefined,
): BillingInvoice[] {
	if (!raw?.trim()) return [];
	const rows = z.array(invoiceSchema).max(1000).parse(JSON.parse(raw));
	const unique = new Map<string, BillingInvoice>();
	for (const row of rows) {
		if (row.issuedOn > row.reviewedOn)
			throw new Error("Invoice review precedes issue date");
		const key = `${row.provider}:${row.reference}`;
		const previous = unique.get(key);
		if (previous && JSON.stringify(previous) !== JSON.stringify(row))
			throw new Error("Conflicting invoice snapshots");
		unique.set(key, row);
	}
	return [...unique.values()];
}
