"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Panel, PanelHeader } from "./ui-primitives";

type Overview = {
  months: { month: string; runs: number; confirmed: number; amountUsd: number; synced: number }[];
  accountMonths: {month: string; days: number; amountUsd: number; synced: number}[];
  accountStorageReady: boolean;
  missingRunIds: number;
  machineAiConfigured: boolean;
  syncEnabled: boolean;
  studioUrl: string | null;
};
const queryKey = ["provider-costs"];
const usd = (amount: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(amount);

export function ProviderCostPanel() {
  const queryClient = useQueryClient();
  const query = useQuery<Overview>({ queryKey, queryFn: async () => {
    const response = await fetch("/api/operations/costs");
    if (!response.ok) throw new Error("Không thể tải chi phí.");
    return response.json();
  } });
  const mutation = useMutation({ mutationFn: async () => {
    const response = await fetch("/api/operations/costs", { method: "POST" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Không thể đối soát.");
    return body as { reconciliation: { confirmed: number; attempted: number; unavailable: number }; sync: { synced: number; status: string } };
  }, onSuccess: () => queryClient.invalidateQueries({ queryKey }) });
  const data = query.data;
  return <Panel>
    <PanelHeader title="Chi phí nhà cung cấp" description="Apify: tổng chi phí tài khoản và đối soát lượt chạy theo tháng UTC. Tách biệt với tín dụng AI."
      action={<button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold disabled:opacity-50"><RefreshCw size={14} className={mutation.isPending ? "animate-spin motion-reduce:animate-none" : ""} />{mutation.isPending ? "Đang đối soát…" : "Đối soát & đồng bộ"}</button>} />
    <div className="space-y-3 p-4 text-sm">
      <p className="text-[var(--muted)]">Mỗi lần đối soát kiểm tra tối đa 10 lượt cũ qua Apify, không chạy lại scraper. Chi phí chưa xác minh không được tính là 0.</p>
      {query.isPending ? <p role="status">Đang tải chi phí…</p> : null}
      {query.isError ? <p role="alert">Không thể tải chi phí. <button type="button" onClick={() => void query.refetch()} className="underline">Thử lại</button></p> : null}
      {data ? <>
        {!data.machineAiConfigured ? <p className="rounded-lg bg-[var(--warning-soft)] p-3 text-[var(--warning-strong)]">Chưa cấu hình khóa AI nền của Tuturuuu. Các tác vụ dùng khóa trực tiếp chưa được tổng hợp trong AI Studio.</p> : null}
        {!data.syncEnabled ? <p>Chi phí đang lưu tại CS35; đồng bộ AI Studio chưa được bật.</p> : null}
        {!data.accountStorageReady ? <p>Đang chờ cập nhật cơ sở dữ liệu để lưu tổng chi phí tài khoản.</p> : null}
        {data.accountMonths.length ? <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
          <h3 className="font-semibold">Tổng chi phí tài khoản Apify chuyên dùng cho CS35</h3>
          <p className="text-xs text-[var(--muted)]">Bao gồm phí sự kiện, dữ liệu và lưu trữ do Apify báo cáo. Mỗi bản ghi là một ngày của một tài khoản; nhiều tài khoản có thể cùng ngày. Đã bao gồm chi phí các lượt bên dưới; không cộng hai bảng với nhau.</p>
          {data.accountMonths.map(month => <div key={month.month} className="flex flex-wrap justify-between gap-2 border-b border-[var(--border)] py-2"><span>{month.month} · {month.days} bản ghi ngày · {month.synced}/{month.days} đã đồng bộ</span><strong>{usd(month.amountUsd)}</strong></div>)}
        </div> : null}
        <h3 className="font-semibold">Chi tiết lượt chạy còn truy cập được</h3>
        {data.missingRunIds ? <p>{data.missingRunIds} lượt thiếu mã Apify nên chưa thể xác minh chi phí.</p> : null}
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-xs"><caption className="sr-only">Chi phí Apify đã xác minh theo tháng UTC</caption><thead><tr className="border-b border-[var(--border)]"><th className="py-2">Tháng UTC</th><th>Đã xác minh / lượt</th><th>Đã đồng bộ</th><th className="text-right">Chi phí xác minh (USD)</th></tr></thead><tbody>{data.months.map(month => <tr key={month.month} className="border-b border-[var(--border)]"><td className="py-3">{month.month}</td><td>{month.confirmed} / {month.runs}</td><td>{month.synced} / {month.confirmed}</td><td className="text-right font-semibold">{month.confirmed ? usd(month.amountUsd) : "Chưa xác minh"}</td></tr>)}</tbody></table></div>
        {!data.months.length ? <p>Chưa có lượt Apify được ghi nhận.</p> : null}
        {data.studioUrl ? <a href={data.studioUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Mở chi phí trong AI Studio <ExternalLink size={13} /></a> : null}
      </> : null}
      {mutation.isError ? <p role="alert">{mutation.error.message}</p> : null}
      {mutation.data ? <p role="status">Đã xác minh {mutation.data.reconciliation.confirmed}/{mutation.data.reconciliation.attempted} lượt; {mutation.data.reconciliation.unavailable} lượt chưa truy cập được. Đã đồng bộ {mutation.data.sync.synced} bản ghi chi phí.{mutation.data.sync.status !== "ready" ? " Đồng bộ chưa hoàn tất; kiểm tra cấu hình Tuturuuu hoặc thử lại." : ""}</p> : null}
    </div>
  </Panel>;
}
