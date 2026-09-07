"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Coins, ExternalLink, RefreshCw } from "lucide-react";
import { CostCurrencyControl, useCostCurrency } from "./cost-currency";
import { Panel, PanelHeader } from "./ui-primitives";

type Overview = {
	months: {
		month: string;
		runs: number;
		confirmed: number;
		amountUsd: number;
		synced: number;
	}[];
	accountMonths: {
		month: string;
		days: number;
		amountUsd: number;
		synced: number;
	}[];
	accountStorageReady: boolean;
	missingRunIds: number;
	machineAiConfigured: boolean;
	syncEnabled: boolean;
	studioUrl: string | null;
};
const queryKey = ["provider-costs"];
export function ProviderCostPanel({
	hideCurrencyControl = false,
}: {
	hideCurrencyControl?: boolean;
}) {
	const cost = useCostCurrency();
	const usd = cost.format;
	const queryClient = useQueryClient();
	const query = useQuery<Overview>({
		queryKey,
		queryFn: async () => {
			const response = await fetch("/api/operations/costs");
			if (!response.ok) throw new Error("Không thể tải chi phí.");
			return response.json();
		},
	});
	const mutation = useMutation({
		mutationFn: async () => {
			const response = await fetch("/api/operations/costs", { method: "POST" });
			const body = await response.json();
			if (!response.ok) throw new Error(body.error || "Không thể đối soát.");
			return body as {
				reconciliation: {
					confirmed: number;
					attempted: number;
					unavailable: number;
				};
				sync: { synced: number; invoicesSynced?: number; status: string };
			};
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey }),
				queryClient.invalidateQueries({ queryKey: ["usage-overview"] }),
			]);
		},
	});
	const data = query.data;
	const total =
		data?.accountMonths.reduce((sum, month) => sum + month.amountUsd, 0) ?? 0;
	const days =
		data?.accountMonths.reduce((sum, month) => sum + month.days, 0) ?? 0;
	const synced =
		data?.accountMonths.reduce((sum, month) => sum + month.synced, 0) ?? 0;
	return (
		<Panel>
			{!hideCurrencyControl && (
				<div className="p-5">
					<CostCurrencyControl />
				</div>
			)}
			<PanelHeader
				title="Chi phí nhà cung cấp"
				description="Apify: tổng chi phí tài khoản và đối soát lượt chạy theo tháng UTC. Tách biệt với tín dụng AI."
				action={
					<button
						type="button"
						disabled={mutation.isPending}
						onClick={() => mutation.mutate()}
						className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-50"
					>
						<RefreshCw
							size={14}
							className={
								mutation.isPending
									? "animate-spin motion-reduce:animate-none"
									: ""
							}
						/>
						{mutation.isPending ? "Đang đối soát…" : "Đối soát & đồng bộ"}
					</button>
				}
			/>
			<div className="space-y-4 p-5 text-sm">
				<p className="text-[var(--muted)]">
					Mỗi lần đối soát kiểm tra tối đa 10 lượt cũ qua Apify, không chạy lại
					scraper. Chi phí chưa xác minh không được tính là 0.
				</p>
				{query.isPending ? <p role="status">Đang tải chi phí…</p> : null}
				{query.isError ? (
					<p role="alert">
						Không thể tải chi phí.{" "}
						<button
							type="button"
							onClick={() => void query.refetch()}
							className="underline"
						>
							Thử lại
						</button>
					</p>
				) : null}
				{data ? (
					<>
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
								<p className="flex items-center gap-2 text-xs text-[var(--muted)]">
									<Coins size={16} />
									Chi phí tài khoản đã ghi nhận
								</p>
								<p className="mt-2 text-2xl font-semibold tabular-nums">
									{days ? usd(total) : "Chưa có dữ liệu"}
								</p>
								<p className="mt-1 text-xs text-[var(--muted)]">
									{data.accountMonths.length} tháng có dữ liệu ·{" "}
									{cost.effectiveCurrency} · không cộng thêm chi phí lượt chạy
								</p>
							</div>
							<div className="rounded-xl border border-[var(--border)] p-4">
								<p className="flex items-center gap-2 text-xs text-[var(--muted)]">
									<CheckCheck size={16} />
									Đồng bộ AI Studio
								</p>
								<p className="mt-2 text-2xl font-semibold tabular-nums">
									{synced} / {days}
								</p>
								<p className="mt-1 text-xs text-[var(--muted)]">
									Bản ghi ngày đã đồng bộ · {Math.max(0, days - synced)} bản ghi
									còn lại
								</p>
							</div>
						</div>
						{!data.machineAiConfigured ? (
							<p className="rounded-lg bg-[var(--warning-soft)] p-3 text-[var(--warning-strong)]">
								Chưa cấu hình khóa AI nền của Tuturuuu. Các tác vụ dùng khóa
								trực tiếp chưa được tổng hợp trong AI Studio.
							</p>
						) : null}
						{!data.syncEnabled ? (
							<p>Chi phí đang lưu tại CS35; đồng bộ AI Studio chưa được bật.</p>
						) : null}
						{!data.accountStorageReady ? (
							<p>
								Đang chờ cập nhật cơ sở dữ liệu để lưu tổng chi phí tài khoản.
							</p>
						) : null}
						{data.accountMonths.length ? (
							<div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
								<h3 className="font-semibold">
									Tổng chi phí tài khoản Apify chuyên dùng cho CS35
								</h3>
								<p className="text-xs text-[var(--muted)]">
									Bao gồm phí sự kiện, dữ liệu và lưu trữ do Apify báo cáo. Mỗi
									bản ghi là một ngày của một tài khoản; nhiều tài khoản có thể
									cùng ngày. Đã bao gồm chi phí các lượt bên dưới; không cộng
									hai bảng với nhau.
								</p>
								{data.accountMonths.map((month) => (
									<div
										key={month.month}
										className="flex flex-wrap justify-between gap-2 border-b border-[var(--border)] py-2"
									>
										<span>
											{month.month} · {month.days} bản ghi ngày · {month.synced}
											/{month.days} đã đồng bộ
										</span>
										<strong>{usd(month.amountUsd)}</strong>
									</div>
								))}
							</div>
						) : null}
						<details className="rounded-xl border border-[var(--border)] p-4">
							<summary className="cursor-pointer font-semibold">
								Chi tiết lượt chạy còn truy cập được
							</summary>
							<div className="mt-3 space-y-3">
								{data.missingRunIds ? (
									<p>
										{data.missingRunIds} lượt thiếu mã Apify nên chưa thể xác
										minh chi phí.
									</p>
								) : null}
								<div className="overflow-x-auto">
									<table className="w-full min-w-[480px] text-left text-xs">
										<caption className="sr-only">
											Chi phí Apify đã xác minh theo tháng UTC
										</caption>
										<thead>
											<tr className="border-b border-[var(--border)]">
												<th className="py-2">Tháng UTC</th>
												<th>Đã xác minh / lượt</th>
												<th>Đã đồng bộ</th>
												<th className="text-right">
													Chi phí xác minh ({cost.effectiveCurrency})
												</th>
											</tr>
										</thead>
										<tbody>
											{data.months.map((month) => (
												<tr
													key={month.month}
													className="border-b border-[var(--border)]"
												>
													<td className="py-3">{month.month}</td>
													<td>
														{month.confirmed} / {month.runs}
													</td>
													<td>
														{month.synced} / {month.confirmed}
													</td>
													<td className="text-right font-semibold">
														{month.confirmed
															? usd(month.amountUsd)
															: "Chưa xác minh"}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								{!data.months.length ? (
									<p>Chưa có lượt Apify được ghi nhận.</p>
								) : null}
							</div>
						</details>
						{data.studioUrl ? (
							<a
								href={data.studioUrl}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1 underline"
							>
								Mở chi phí trong AI Studio <ExternalLink size={13} />
							</a>
						) : null}
					</>
				) : null}
				{mutation.isError ? <p role="alert">{mutation.error.message}</p> : null}
				{mutation.data ? (
					<p role="status">
						Đã xác minh {mutation.data.reconciliation.confirmed}/
						{mutation.data.reconciliation.attempted} lượt;{" "}
						{mutation.data.reconciliation.unavailable} lượt chưa truy cập được.
						Đã đồng bộ {mutation.data.sync.synced} bản ghi chi phí.
						{mutation.data.sync.invoicesSynced !== undefined
							? ` Tuturuuu đã xác nhận ${mutation.data.sync.invoicesSynced} hóa đơn đã lưu.`
							: ""}
						{mutation.data.sync.status === "invoice_upstream_409"
							? " Hóa đơn xung đột với biên nhận đã lưu; cần đối soát trước khi gửi lại."
							: mutation.data.sync.status !== "ready"
								? " Đồng bộ chưa hoàn tất; kiểm tra cấu hình Tuturuuu hoặc thử lại."
								: ""}
					</p>
				) : null}
			</div>
		</Panel>
	);
}
