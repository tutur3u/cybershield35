import { z } from "zod";
const chargeSchema = z.object({
	Tags: z.object({ ProjectId: z.string().optional() }).optional(),
	ChargePeriodStart: z.string(),
	ServiceName: z.string(),
	BilledCost: z.number().finite(),
	PricingUnit: z.string().optional(),
});
export function parseVercelCharges(text: string, projectId: string) {
	const records = new Map<
		string,
		{ accountId: string; day: string; amountUsd: number }
	>();
	for (const line of text.split(/\r?\n/).filter((line) => line.trim())) {
		const value: unknown = JSON.parse(line);
		if (
			!value ||
			typeof value !== "object" ||
			!("Tags" in value) ||
			(value as { Tags?: { ProjectId?: string } }).Tags?.ProjectId !== projectId
		)
			continue;
		const charge = chargeSchema.parse(value);
		if (charge.PricingUnit && charge.PricingUnit !== "USD")
			throw new Error("Unsupported billing currency");
		const day = new Date(charge.ChargePeriodStart).toISOString().slice(0, 10);
		const accountId = `${projectId}-${charge.ServiceName.toLowerCase()
			.replace(/[^a-z0-9]+/g, "_")
			.slice(0, 80)}`;
		const key = `${accountId}:${day}`;
		const row = records.get(key) ?? { accountId, day, amountUsd: 0 };
		row.amountUsd += charge.BilledCost;
		records.set(key, row);
	}
	const rows = [...records.values()];
	if (rows.some((row) => row.amountUsd < 0))
		throw new Error(
			"Negative daily adjustments require invoice reconciliation",
		);
	return rows;
}
