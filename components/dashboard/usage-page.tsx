"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Coins, Download, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { UsageOverview } from "@/lib/costs/usage";
import { PageHeader } from "./page-header";
import { ProviderCostPanel } from "./provider-cost-panel";
import { QueryFeedback } from "./query-feedback";
import { Panel, PanelHeader, SecondaryButton } from "./ui-primitives";
import { UsageBreakdown } from "./usage-breakdown";

const usd = (n: number) =>
	new Intl.NumberFormat("vi-VN", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 6,
	}).format(n);
export const usageQueryOptions = {
	queryKey: ["usage-overview"],
	staleTime: 60_000,
	queryFn: async (): Promise<UsageOverview> => {
		const response = await fetch("/api/usage");
		if (!response.ok) throw new Error("Usage unavailable");
		return response.json();
	},
};
export function UsageSummary() {
	const query = useQuery(usageQueryOptions);
	return (
		<Panel className="min-w-0">
			<PanelHeader
				title="Chi phí đã ghi nhận"
				description="Tổng chi phí · 30 ngày UTC"
				action={
					<Link
						href="/usage"
						className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-strong)]"
					>
						Xem chi phí <ArrowUpRight size={14} />
					</Link>
				}
			/>
			<QueryFeedback
				pending={query.isPending}
				failed={query.isError}
				onRetry={() => void query.refetch()}
			/>
			{query.data && (
				<div className="px-5 pb-5">
					<p className="text-3xl font-semibold tabular-nums">
						{query.data.bill.days.length
							? usd(query.data.bill.last30Days)
							: "Chưa có dữ liệu"}
					</p>
					<p className="mt-2 text-xs leading-5 text-[var(--muted)]">
						Apify, AI và dịch vụ đã kết nối. Xem phạm vi và hóa đơn còn thiếu.
					</p>
				</div>
			)}
		</Panel>
	);
}
export function UsagePage() {
	const query = useQuery(usageQueryOptions);
	const [period, setPeriod] = useState<"30" | "all">("30");
	const data = query.data;
	const bill = data?.bill;
	const rows = bill ? (period === "30" ? bill.recentDays : bill.days) : [];
	const chart = bill
		? Array.from({ length: 30 }, (_, index) => {
				const date = new Date(`${bill.from}T00:00:00Z`);
				date.setUTCDate(date.getUTCDate() + index);
				const day = date.toISOString().slice(0, 10);
				return {
					day,
					amount:
						bill.recentDays.find((row) => row.day === day)?.amountUsd ?? null,
				};
			})
		: [];
	const max = Math.max(...chart.map((row) => row.amount ?? 0), 0);
	const download = () => {
		if (!bill) return;
		const cell = (value: string | number) =>
			`"${String(value)
				.replace(/^[=+@-]/, "'$&")
				.replaceAll('"', '""')}"`;
		const csv = [
			"day_utc,provider,service,mode,amount_usd,requests,input_tokens,output_tokens,source",
			...bill.lines.map((row) =>
				[
					row.day,
					row.provider,
					row.service,
					row.mode,
					row.amountUsd.toFixed(9),
					row.requests,
					row.inputTokens,
					row.outputTokens,
					row.source,
				]
					.map(cell)
					.join(","),
			),
		].join("\r\n");
		const url = URL.createObjectURL(
			new Blob([csv], { type: "text/csv;charset=utf-8" }),
		);
		const link = document.createElement("a");
		link.href = url;
		link.download = `cs35-usage-${bill.today}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	};
	return (
		<div className="min-w-0 space-y-6 [&_.workspace-panel]:[content-visibility:visible]">
			<PageHeader
				icon={Coins}
				title="Mức sử dụng & chi phí"
				description="Một nơi để theo dõi chi phí, hiểu khoản nào tăng và kiểm tra dữ liệu đối soát."
				actions={
					<>
						<SecondaryButton
							disabled={query.isFetching}
							onClick={() => void query.refetch()}
						>
							<RefreshCw size={15} /> Làm mới
						</SecondaryButton>
						<SecondaryButton disabled={!bill?.lines.length} onClick={download}>
							<Download size={15} /> Xuất CSV
						</SecondaryButton>
					</>
				}
			/>
			<QueryFeedback
				pending={query.isPending}
				failed={query.isError}
				onRetry={() => void query.refetch()}
			/>
			{data && bill && (
				<>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="text-xs text-[var(--muted)]">
							USD · Ngày UTC · Tài khoản dành riêng cho CS35
						</p>
						<label className="flex items-center gap-2 text-sm text-[var(--muted)]">
							Phân tích
							<select
								aria-label="Khoảng thời gian chi phí"
								value={period}
								onChange={(event) =>
									setPeriod(event.target.value as "30" | "all")
								}
								className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--foreground)]"
							>
								<option value="30">30 ngày</option>
								<option value="all">Toàn thời gian</option>
							</select>
						</label>
					</div>
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						{[
							{
								label: "Toàn thời gian",
								value: bill.allTime,
								detail: bill.firstDay
									? `Từ ${bill.firstDay}`
									: "Chưa có lịch sử",
							},
							{
								label: "30 ngày gần nhất",
								value: bill.last30Days,
								detail: `${bill.from} → ${bill.today}`,
							},
							{
								label: "Tháng này",
								value: bill.thisMonth,
								detail: `Từ ${bill.today.slice(0, 7)}-01 · UTC`,
							},
							{
								label: "Hôm nay",
								value: bill.todayCost,
								detail: `${bill.today} · Có thể cập nhật thêm`,
							},
						].map((item, index) => (
							<section
								key={item.label}
								className={`min-w-0 rounded-xl border p-5 ${index === 1 ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface)]"}`}
							>
								<h2 className="text-sm font-semibold text-[var(--muted-strong)]">
									{item.label}
								</h2>
								<p className="mt-3 break-words text-2xl font-bold tabular-nums">
									{bill.days.length &&
									(index !== 3 ||
										bill.days.some((row) => row.day === bill.today))
										? usd(item.value)
										: "Chưa ghi nhận"}
								</p>
								<p className="mt-2 text-xs text-[var(--muted)]">
									{item.detail}
								</p>
							</section>
						))}
					</div>
					<div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4 text-sm leading-6 text-[var(--muted-strong)]">
						<strong className="text-[var(--foreground)]">
							Tổng ghi nhận chưa phải hóa đơn đầy đủ.
						</strong>{" "}
						Apify được tính từ tổng tài khoản, AI từ sổ đo lường Tuturuuu,
						Browser Use từ chi phí phiên, Vercel từ phí hosting sau tín dụng.
						Không cộng lại tín dụng AI hoặc biên nhận Apify. Firecrawl và Neon
						chưa có dữ liệu hóa đơn; xem phạm vi từng nhà cung cấp bên dưới.
					</div>
					<UsageBreakdown data={data} period={period} />
					<div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
						<Panel className="min-w-0">
							<PanelHeader
								title="Lịch sử tổng chi phí"
								description="Biểu đồ 30 ngày UTC; bảng theo khoảng đã chọn."
							/>
							<figure
								className="border-b border-[var(--divider)] px-5 pb-5"
								aria-label="Biểu đồ tổng chi phí 30 ngày UTC"
							>
								<div className="flex h-28 items-end gap-1" aria-hidden="true">
									{chart.map((row) => (
										<div
											key={row.day}
											title={`${row.day}: ${row.amount === null ? "Chưa ghi nhận" : usd(row.amount)}`}
											className={`min-w-0 flex-1 rounded-t-sm ${row.amount === null ? "border border-dashed border-[var(--border-strong)]" : "bg-[var(--accent)]"}`}
											style={{
												height:
													row.amount === null
														? "12%"
														: `${Math.max(2, max ? (row.amount / max) * 100 : 2)}%`,
											}}
										/>
									))}
								</div>
								<figcaption className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-[var(--muted)]">
									<span>
										{bill.from} → {bill.today}
									</span>
									<span>Cao nhất {usd(max)}/ngày</span>
									<span className="w-full">
										Nét đứt: chưa ghi nhận. Bảng bên dưới cung cấp số liệu chi
										tiết.
									</span>
								</figcaption>
							</figure>
							<div className="max-h-96 overflow-auto">
								<table
									aria-label="Lịch sử chi phí hàng ngày"
									className="w-full text-left text-sm"
								>
									<thead className="sticky top-0 bg-[var(--surface-soft)] text-xs text-[var(--muted)]">
										<tr>
											<th className="px-4 py-3">Ngày UTC</th>
											<th className="px-3 py-3 text-right">Chi phí</th>
											<th className="px-4 py-3">Nguồn</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-[var(--divider)]">
										{rows.map((row) => (
											<tr key={row.day}>
												<td className="whitespace-nowrap px-4 py-3 tabular-nums">
													{row.day}
												</td>
												<td className="px-3 py-3 text-right font-semibold tabular-nums">
													{usd(row.amountUsd)}
												</td>
												<td className="px-4 py-3 text-xs text-[var(--muted)]">
													{[
														...new Set(
															bill.lines
																.filter((line) => line.day === row.day)
																.map((line) => line.provider),
														),
													].join(" · ")}
												</td>
											</tr>
										))}
									</tbody>
								</table>
								{!rows.length && (
									<p className="p-5 text-sm text-[var(--muted)]">
										Chưa có bản ghi. Ngày chưa nhập không đồng nghĩa với chi phí
										bằng 0.
									</p>
								)}
							</div>
						</Panel>
						<div className="min-w-0 space-y-5">
							<Panel className="min-w-0">
								<PanelHeader
									title="Đối soát Tuturuuu"
									description="Bản ghi chi phí nhà cung cấp đã nhập vào AI Studio"
								/>
								<div className="space-y-3 px-5 pb-5">
									{data.providerSync.map((row) => (
										<p
											key={row.provider}
											className="flex justify-between gap-3 text-sm"
										>
											<span>
												{(
													{
														apify: "Apify",
														vercel: "Vercel",
														browser_use: "Browser Use",
													} as Record<string, string>
												)[row.provider] ?? row.provider}
											</span>
											<span className="font-semibold tabular-nums">
												{row.synced}/{row.records} bản ghi
											</span>
										</p>
									))}
									<p className="text-xs leading-5 text-[var(--muted)]">
										{data.observedAt
											? `Bản ghi Apify cập nhật: ${new Date(data.observedAt).toLocaleString("vi-VN")}`
											: "Chưa có dữ liệu Apify."}
									</p>
									<p className="text-xs leading-5 text-[var(--muted)]">
										{data.aiThrough
											? `AI: dữ liệu đến ${new Date(data.aiThrough).toLocaleString("vi-VN")}`
											: "Chưa đọc được dữ liệu AI mới nhất."}
									</p>
									{data.studioUrl && (
										<a
											href={data.studioUrl}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent-strong)]"
										>
											Mở Tuturuuu AI Studio <ArrowUpRight size={15} />
										</a>
									)}
								</div>
							</Panel>
							<Panel className="min-w-0">
								<PanelHeader
									title="Nhật ký Chat"
									description="Mức sử dụng Chat trong 30 ngày"
								/>
								<div className="px-5 pb-5">
									<p className="text-xl font-semibold">
										{data.chat.requests30.toLocaleString("vi-VN")} lượt ·{" "}
										{data.chat.tokens30.toLocaleString("vi-VN")} token
									</p>
									<p className="mt-3 text-xs leading-5 text-[var(--muted)]">
										Chỉ gồm nhật ký Chat còn lưu, không gồm AI nền. Số token này
										không cộng thêm vào chi phí AI ở trên.
									</p>
								</div>
							</Panel>
						</div>
					</div>
				</>
			)}
			<details className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
				<summary className="cursor-pointer p-5 text-sm font-semibold">
					Đối soát Apify & biên nhận lượt chạy
				</summary>
				<div className="p-3 pt-0">
					<ProviderCostPanel />
				</div>
			</details>
		</div>
	);
}
