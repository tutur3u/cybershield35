"use client";
import type { UsageOverview } from "@/lib/costs/usage";
import { Panel, PanelHeader } from "./ui-primitives";
const usd = (n: number) =>
	new Intl.NumberFormat("vi-VN", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 6,
	}).format(n);

export function UsageBreakdown({
	data,
	period,
}: {
	data: UsageOverview;
	period: "30" | "all";
}) {
	const providers =
		period === "30" ? data.bill.providers30 : data.bill.providers;
	const services = period === "30" ? data.bill.services30 : data.bill.services;
	const modes = period === "30" ? data.bill.modes30 : data.bill.modes;
	const total = period === "30" ? data.bill.last30Days : data.bill.allTime;
	const sourceRows = [
		{
			name: "Apify",
			ready: data.records > 0,
			detail:
				"Tổng tài khoản đã đối soát; đã gồm phí quét theo ngày, sự kiện và lưu trữ.",
		},
		{
			name: "AI",
			ready: data.aiStatus === "ready",
			detail:
				data.aiStatus === "ready"
					? "Chi phí mô hình do Tuturuuu ghi nhận, gồm AI nền và tương tác. Không cộng lại tín dụng AI."
					: "Chưa đọc được sổ chi phí Tuturuuu. Tổng hiện tại chưa gồm AI.",
		},
		{
			name: "Browser Use",
			ready:
				data.browserStatus === "ready" ||
				data.bill.providers.some((row) => row.name === "Browser Use"),
			detail:
				data.browserStatus === "ready"
					? "Chi phí phiên còn lưu tại nhà cung cấp, gồm LLM, proxy và trình duyệt; chưa đối soát hóa đơn thuê bao."
					: "Chưa làm mới được lịch sử Browser Use; dùng chi phí đã lưu nếu có.",
		},
		{
			name: "Firecrawl",
			ready: false,
			detail:
				data.firecrawl.status === "ready"
					? `Còn ${data.firecrawl.remaining?.toLocaleString("vi-VN")} credit. Kiểm tra tài khoản CS35 ngày 07/09/2026: gói Free, không có hóa đơn. Đây là xác nhận tại thời điểm kiểm tra; chưa đồng bộ hóa đơn tự động.`
					: "Cần dữ liệu hóa đơn và mức sử dụng Firecrawl.",
		},
		{
			name: "Vercel",
			ready: data.bill.providers.some((row) => row.name === "Vercel"),
			detail:
				"Chi phí hosting CS35 đã nhập từ Vercel sau tín dụng; không cộng thêm giá trước tín dụng hoặc phí chung chưa phân bổ.",
		},
		{
			name: "Neon",
			ready: false,
			detail:
				"Neon: chưa kết nối dữ liệu hóa đơn. Không coi chi phí chưa nhập là miễn phí.",
		},
	];
	return (
		<div className="space-y-5">
			<Panel className="min-w-0">
				<PanelHeader
					title="Chi phí theo nhà cung cấp"
					description={`${period === "30" ? "30 ngày gần nhất" : "Toàn thời gian"} · Nguồn số liệu và phạm vi đối soát`}
				/>
				<div className="divide-y divide-[var(--divider)]">
					{sourceRows.map((row) => {
						const amount =
							providers.find((item) => item.name === row.name)?.amountUsd ?? 0;
						return (
							<div
								key={row.name}
								className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_auto]"
							>
								<div>
									<h3 className="font-semibold">{row.name}</h3>
									<p className="mt-1 text-xs leading-5 text-[var(--muted)]">
										{row.detail}
									</p>
									{row.ready && (
										<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]">
											<div
												className="h-full rounded-full bg-[var(--accent)]"
												style={{
													width: `${total ? (amount / total) * 100 : 0}%`,
												}}
											/>
										</div>
									)}
								</div>
								<div className="text-sm font-semibold tabular-nums sm:text-right">
									{row.ready ? usd(amount) : "Chưa đủ dữ liệu"}
									{row.ready && (
										<p className="mt-1 text-xs font-normal text-[var(--muted)]">
											{total ? ((amount / total) * 100).toFixed(1) : "0"}% tổng
											ghi nhận
										</p>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</Panel>
			<div className="grid items-start gap-5 lg:grid-cols-2">
				<Panel className="min-w-0">
					<PanelHeader
						title="Mô hình & dịch vụ"
						description="Chi phí và mức sử dụng trong khoảng đã chọn"
					/>
					<div className="max-h-80 divide-y divide-[var(--divider)] overflow-auto">
						{services.map((row) => (
							<div
								key={row.name}
								className="flex items-start justify-between gap-4 px-5 py-3"
							>
								<div className="min-w-0">
									<p className="break-words text-sm font-semibold">
										{row.name}
									</p>
									<p className="mt-1 text-xs text-[var(--muted)]">
										{row.requests || row.tokens
											? `${row.requests.toLocaleString("vi-VN")} yêu cầu · ${row.tokens.toLocaleString("vi-VN")} token`
											: "Tổng theo tài khoản"}
									</p>
								</div>
								<span className="shrink-0 text-sm tabular-nums">
									{usd(row.amountUsd)}
								</span>
							</div>
						))}
						{!services.length && (
							<p className="p-5 text-sm text-[var(--muted)]">
								Chưa có chi phí trong khoảng này.
							</p>
						)}
					</div>
				</Panel>
				<Panel className="min-w-0">
					<PanelHeader
						title="Chi phí theo hoạt động"
						description="Phân biệt AI tự động, AI tương tác và dịch vụ thu thập"
					/>
					<div className="divide-y divide-[var(--divider)]">
						{modes.map((row) => (
							<div
								key={row.name}
								className="flex justify-between gap-4 px-5 py-4 text-sm"
							>
								<span>{row.name}</span>
								<span className="font-semibold tabular-nums">
									{usd(row.amountUsd)}
								</span>
							</div>
						))}
					</div>
				</Panel>
			</div>
		</div>
	);
}
