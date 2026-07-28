"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	ExternalLink,
	LoaderCircle,
	Radio,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useState } from "react";

import { Panel, PanelHeader } from "@/components/dashboard/ui-primitives";

type ZaloAccount = {
	avatarUrl: string | null;
	displayName: string;
	id: string;
	isDefault: boolean;
	lastError: string | null;
	oaId: string;
	status: string;
	updatedAt: string;
};

export function ZaloSettingsPanel() {
	const queryClient = useQueryClient();
	const params = useSearchParams();
	const [busy, setBusy] = useState("");
	const [notice, setNotice] = useState(
		params.get("message") ?? "",
	);
	const query = useQuery({
		queryKey: ["zalo", "accounts"],
		queryFn: () =>
			fetchJson<{
				accounts: ZaloAccount[];
				configured: boolean;
				enabled: boolean;
			}>("/api/integrations/zalo/accounts"),
	});

	async function mutate(id: string, action: "default" | "disconnect") {
		if (
			action === "disconnect" &&
			!window.confirm(
				"Ngắt kết nối OA này? Các bài viết đã xuất bản vẫn được giữ trên Zalo.",
			)
		) {
			return;
		}
		setBusy(`${action}:${id}`);
		setNotice("");
		try {
			await fetchJson(`/api/integrations/zalo/accounts/${id}`, {
				...(action === "default"
					? {
							body: JSON.stringify({ isDefault: true }),
							headers: { "Content-Type": "application/json" },
							method: "PATCH",
						}
					: { method: "DELETE" }),
			});
			setNotice(
				action === "default"
					? "Đã chọn OA mặc định."
					: "Đã ngắt kết nối Zalo OA.",
			);
			await queryClient.invalidateQueries({ queryKey: ["zalo", "accounts"] });
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Thao tác không thành công.");
		} finally {
			setBusy("");
		}
	}

	return (
		<Panel>
			<PanelHeader
				title="Zalo Official Account"
				description="Kết nối nhiều OA bằng OAuth. Token được mã hóa trên máy chủ và tự xoay vòng khi hết hạn."
				action={
					query.data?.enabled ? (
						<a
							href="/api/integrations/zalo/connect"
							className="inline-flex h-10 items-center gap-2 rounded-md bg-[#0068ff] px-3 text-[12px] font-bold text-white"
						>
							<ExternalLink size={14} />
							Kết nối OA
						</a>
					) : null
				}
			/>
			<div className="space-y-4 p-4">
				{notice ? (
					<div
						role="status"
						className={`rounded-md border px-3 py-2.5 text-[11px] font-semibold ${
							params.get("zalo") === "error"
								? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-strong)]"
								: "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]"
						}`}
					>
						{notice}
					</div>
				) : null}
				{query.isPending ? (
					<div className="grid min-h-32 place-items-center">
						<LoaderCircle className="animate-spin text-[var(--brand)]" size={24} />
					</div>
				) : query.isError ? (
					<p className="text-sm text-[var(--danger-strong)]">{query.error.message}</p>
				) : !query.data.configured || !query.data.enabled ? (
					<div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4">
						<div className="flex items-start gap-3">
							<ShieldCheck size={18} className="mt-0.5 text-[var(--warning-strong)]" />
							<div>
								<p className="text-[12px] font-bold text-[var(--warning-strong)]">
									Tích hợp chưa được bật
								</p>
								<p className="mt-1 text-[11px] leading-5 text-[var(--muted-strong)]">
									Cấu hình ZALO_APP_ID, ZALO_APP_SECRET,
									ZALO_TOKEN_ENCRYPTION_KEY và callback URL; sau đó đặt
									ZALO_OA_ENABLED=true. Không giá trị bí mật nào được gửi xuống
									trình duyệt.
								</p>
							</div>
						</div>
					</div>
				) : query.data.accounts.length === 0 ? (
					<div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-6 text-center">
						<div>
							<Radio size={24} className="mx-auto text-[#0068ff]" />
							<p className="mt-3 text-[12px] font-bold">Chưa kết nối Zalo OA</p>
							<p className="mt-1 text-[11px] text-[var(--muted)]">
								Mỗi thành viên đã đăng nhập đều có thể kết nối và chọn OA đích.
							</p>
						</div>
					</div>
				) : (
					<div className="grid gap-3 md:grid-cols-2">
						{query.data.accounts.map((account) => (
							<div
								key={account.id}
								className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4"
							>
								<div className="flex items-start gap-3">
									{account.avatarUrl ? (
										<Image
											unoptimized
											width={40}
											height={40}
											src={account.avatarUrl}
											alt=""
											className="size-10 rounded-full object-cover"
										/>
									) : (
										<span className="grid size-10 place-items-center rounded-full bg-[#0068ff] text-xs font-bold text-white">
											ZA
										</span>
									)}
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<p className="truncate text-[12px] font-bold">
												{account.displayName}
											</p>
											{account.isDefault ? (
												<span className="inline-flex h-5 items-center gap-1 rounded bg-[var(--success-soft)] px-1.5 text-[9px] font-bold text-[var(--success-strong)]">
													<Check size={10} /> Mặc định
												</span>
											) : null}
										</div>
										<p className="mt-1 text-[10px] text-[var(--muted)]">
											OA ID: {account.oaId}
										</p>
										<p className={`mt-1 text-[10px] font-semibold ${account.status === "connected" ? "text-[var(--success-strong)]" : "text-[var(--warning-strong)]"}`}>
											{account.status === "connected" ? "Đang kết nối" : "Cần ủy quyền lại"}
										</p>
									</div>
								</div>
								{account.lastError ? (
									<p className="mt-3 rounded-md bg-[var(--danger-soft)] p-2 text-[10px] leading-4 text-[var(--danger-strong)]">
										{account.lastError}
									</p>
								) : null}
								<div className="mt-3 flex gap-2 border-t border-[var(--border)] pt-3">
									{!account.isDefault ? (
										<button
											type="button"
											disabled={Boolean(busy)}
											onClick={() => mutate(account.id, "default")}
											className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[10px] font-bold"
										>
											{busy === `default:${account.id}` ? <LoaderCircle size={11} className="animate-spin" /> : <Check size={11} />}
											Đặt mặc định
										</button>
									) : null}
									<button
										type="button"
										disabled={Boolean(busy)}
										onClick={() => mutate(account.id, "disconnect")}
										className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[10px] font-bold text-[var(--danger-strong)]"
									>
										<Trash2 size={11} /> Ngắt kết nối
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</Panel>
	);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, { cache: "no-store", ...init });
	const body = await response.json().catch(() => null);
	if (!response.ok) throw new Error(body?.error ?? "Không thể tải kết nối Zalo OA.");
	return body as T;
}
