"use client";
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import {
	formatCost,
	type CostCurrency,
	type CostExchangeRate,
} from "@/lib/costs/currency";

const key = "cs35-cost-currency";
let fallback: CostCurrency = "VND";
function snapshot(): CostCurrency {
	try {
		const value = localStorage.getItem(key);
		return value === "USD" || value === "VND" ? value : fallback;
	} catch {
		return fallback;
	}
}
function subscribe(listener: () => void) {
	window.addEventListener("storage", listener);
	window.addEventListener(key, listener);
	return () => {
		window.removeEventListener("storage", listener);
		window.removeEventListener(key, listener);
	};
}
export function useCostCurrency() {
	const currency = useSyncExternalStore(
		subscribe,
		snapshot,
		() => "VND" as const,
	);
	const query = useQuery<CostExchangeRate>({
		queryKey: ["cost-exchange-rate"],
		staleTime: 3600000,
		retry: 1,
		queryFn: async () => {
			const response = await fetch("/api/costs/exchange-rate");
			if (!response.ok) throw new Error("Exchange rate unavailable");
			return response.json();
		},
	});
	const effectiveCurrency =
		currency === "VND" && !query.data ? "USD" : currency;
	return {
		currency,
		effectiveCurrency,
		exchange: query.data,
		setCurrency(value: CostCurrency) {
			fallback = value;
			try {
				localStorage.setItem(key, value);
			} catch {
				/* Keep the in-memory preference. */
			}
			window.dispatchEvent(new Event(key));
		},
		format(amount: number) {
			return currency === "VND" && query.isPending
				? "…"
				: formatCost(amount, effectiveCurrency, query.data?.rate);
		},
	};
}

export function CostCurrencyControl({
	compact = false,
}: {
	compact?: boolean;
}) {
	const cost = useCostCurrency();
	return (
		<div className="space-y-2">
			<label className="flex items-center gap-2 text-xs text-[var(--muted)]">
				Tiền tệ
				<select
					aria-label="Tiền tệ chi phí"
					value={cost.currency}
					onChange={(event) =>
						cost.setCurrency(event.target.value as CostCurrency)
					}
					className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--foreground)]"
				>
					<option value="VND">VND · Đồng</option>
					<option value="USD">USD · Đô la Mỹ</option>
				</select>
			</label>
			{cost.currency === "VND" && (
				<p className="text-xs leading-5 text-[var(--muted)]">
					{cost.exchange ? (
						<>
							Ước tính · 1 USD = {cost.exchange.rate.toLocaleString("vi-VN")}{" "}
							VND · {cost.exchange.updatedAt.slice(0, 10)}.{" "}
							{!compact &&
								"Dùng tỷ giá này cho toàn bộ khoảng đã chọn; không phải tỷ giá thanh toán lịch sử. "}
							<a
								className="underline"
								href="https://www.exchangerate-api.com"
								target="_blank"
								rel="noreferrer"
							>
								ExchangeRate-API
							</a>
						</>
					) : (
						"Đang hiển thị USD gốc khi chưa có tỷ giá VND."
					)}
				</p>
			)}
		</div>
	);
}
