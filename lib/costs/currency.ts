import { z } from "zod";

export type CostCurrency = "VND" | "USD";
export type CostExchangeRate = { rate: number; updatedAt: string };
export const exchangeRateSchema = z.object({
	result: z.literal("success"),
	base_code: z.literal("USD"),
	time_last_update_unix: z.number().int().positive(),
	rates: z.object({ VND: z.number().finite().positive() }),
});

export function parseCostExchangeRate(
	value: unknown,
	now = Date.now(),
): CostExchangeRate {
	const data = exchangeRateSchema.parse(value);
	const timestamp = data.time_last_update_unix * 1000;
	if (timestamp > now + 86400000 || now - timestamp > 7 * 86400000)
		throw new Error("Exchange rate is outside the freshness window");
	return { rate: data.rates.VND, updatedAt: new Date(timestamp).toISOString() };
}

export function formatCost(
	amountUsd: number,
	currency: CostCurrency,
	rate = 1,
) {
	const amount = amountUsd * (currency === "VND" ? rate : 1);
	if (amount > 0 && amount < (currency === "VND" ? 1 : 0.000001))
		return currency === "VND" ? "<1 ₫" : "<0,000001 US$";
	return new Intl.NumberFormat("vi-VN", {
		style: "currency",
		currency,
		maximumFractionDigits: currency === "VND" ? 0 : 6,
	}).format(amount);
}
