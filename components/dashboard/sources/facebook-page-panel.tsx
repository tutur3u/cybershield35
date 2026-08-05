"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	LoaderCircle,
	Play,
	Radar,
	Scale,
	Search,
	ShieldAlert,
	ShieldCheck,
	Sparkles,
	type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import type {
	FacebookPageClassification,
	IntelligenceFacebookPageOption,
} from "@/components/dashboard/types";
import { Panel, PanelHeader } from "@/components/dashboard/ui-primitives";
import { intelligenceFacebookPagesQueryOptions } from "@/lib/dashboard/client-queries";

import { ScanRunIndicator } from "./scan-run-indicator";
import type { PagePolicyFeedback } from "./source-utils";
import { useScanRuns } from "./use-scan-runs";

export function FacebookPageTrustPanel() {
	const pagesQueryOptions = intelligenceFacebookPagesQueryOptions();
	const queryClient = useQueryClient();
	const pagesQuery = useQuery(pagesQueryOptions);
	const scanRuns = useScanRuns();
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<FacebookPageClassification | "all">("all");
	const [sort, setSort] = useState<"evidence" | "name">("evidence");
	const [savingKeys, setSavingKeys] = useState<Set<string>>(() => new Set());
	const [feedbackByPage, setFeedbackByPage] = useState<
		Record<string, PagePolicyFeedback>
	>({});
	const pages = pagesQuery.data ?? [];
	const filteredPages = pages
		.filter((page) => {
			if (filter !== "all" && page.classification !== filter) return false;
			const value = query.trim().toLowerCase();
			return (
				!value ||
				page.label.toLowerCase().includes(value) ||
				page.username?.toLowerCase().includes(value) ||
				page.facebookId?.toLowerCase().includes(value)
			);
		})
		.sort((left, right) =>
			sort === "name"
				? left.label.localeCompare(right.label, "vi")
				: right.evidenceCount - left.evidenceCount ||
					left.label.localeCompare(right.label, "vi"),
		);
	const counts = pages.reduce(
		(result, page) => {
			result[page.classification] += 1;
			return result;
		},
		{ at_risk: 0, neutral: 0, trusted: 0, uncategorized: 0 },
	);

	function updateCachedPage(
		pageKey: string,
		patch: Partial<IntelligenceFacebookPageOption>,
	) {
		queryClient.setQueryData<IntelligenceFacebookPageOption[]>(
			pagesQueryOptions.queryKey,
			(current) =>
				current?.map((page) =>
					page.pageKey === pageKey ? { ...page, ...patch } : page,
				),
		);
	}

	async function savePolicy(
		page: IntelligenceFacebookPageOption,
		patch: Partial<
			Pick<IntelligenceFacebookPageOption, "autoDraftEnabled" | "classification">
		>,
	) {
		const classification = patch.classification ?? page.classification;
		const autoDraftEnabled =
			classification === "uncategorized"
				? false
				: (patch.autoDraftEnabled ?? page.autoDraftEnabled);

		setSavingKeys((current) => new Set(current).add(page.pageKey));
		updateCachedPage(page.pageKey, { autoDraftEnabled, classification });
		try {
			const response = await fetch(
				"/api/intelligence/facebook-pages/classification",
				{
					body: JSON.stringify({
						autoDraftEnabled,
						classification,
						displayName: page.label,
						facebookPageId: page.facebookId,
						pageKey: page.pageKey,
						username: page.username,
					}),
					cache: "no-store",
					headers: { "Content-Type": "application/json" },
					method: "PATCH",
				},
			);
			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(payload?.error ?? "Không thể lưu phân loại trang.");
			}
			const enqueued = Number(payload?.enqueued) || 0;
			const savedAutoDraftEnabled =
				payload?.profile?.autoDraftEnabled ?? autoDraftEnabled;
			setFeedbackByPage((current) => ({
				...current,
				[page.pageKey]: {
					message: savedAutoDraftEnabled
						? enqueued
							? `Đã bật · ${enqueued.toLocaleString("vi-VN")} bài đang chờ soạn bản nháp.`
							: "Đã bật · Bài mới từ trang này sẽ tự động có bản nháp chờ duyệt."
						: "Đã tắt · Hệ thống sẽ không tạo thêm bản nháp tự động.",
					tone: "success",
				},
			}));
			await pagesQuery.refetch();
		} catch (error) {
			updateCachedPage(page.pageKey, page);
			setFeedbackByPage((current) => ({
				...current,
				[page.pageKey]: {
					message:
						error instanceof Error ? error.message : "Không thể lưu phân loại trang.",
					tone: "error",
				},
			}));
		} finally {
			setSavingKeys((current) => {
				const next = new Set(current);
				next.delete(page.pageKey);
				return next;
			});
		}
	}

	async function scanNow(page: IntelligenceFacebookPageOption) {
		await scanRuns.start(page.pageKey, async () => {
			const response = await fetch("/api/intelligence/facebook-pages/scan-now", {
				body: JSON.stringify({
					displayName: page.label,
					enqueueOnly: true,
					facebookPageId: page.facebookId,
					pageKey: page.pageKey,
					sourceUrl: page.sourceUrl,
					username: page.username,
				}),
				cache: "no-store",
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			const payload = await response.json().catch(() => null);
			if (!response.ok) throw new Error(payload?.error ?? "Không thể quét trang này.");
			updateCachedPage(page.pageKey, {
				trackedSourceId: payload?.source?.id ?? page.trackedSourceId,
			});
			return { scanId: String(payload.scan.scanId) };
		});
	}

	return (
		<Panel>
			<PanelHeader
				title="Phân loại trang theo dõi"
				description="Chọn cách CS35 xử lý từng trang: ủng hộ nguồn đáng tin, viết trung lập, hoặc phản biện nguồn có rủi ro. Mọi bản nháp đều chờ người duyệt."
				action={
					<span className="inline-flex h-8 items-center gap-2 rounded-md bg-[var(--accent-soft)] px-3 text-[11px] font-bold text-[var(--accent-strong)]">
						<Sparkles size={14} />
						{pages.reduce((sum, page) => sum + page.automation.pending, 0)} bản nháp đang
						chờ
					</span>
				}
			/>
			<div className="grid gap-3 border-b border-[var(--border)] p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
				<label className="relative min-w-0">
					<Search
						className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
						size={15}
					/>
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Tìm tên trang hoặc địa chỉ…"
						className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] pl-9 pr-3 text-[12px] font-semibold outline-none focus:border-[var(--accent)]"
					/>
				</label>
				<div className="flex flex-wrap gap-2">
					<select
						aria-label="Sắp xếp trang"
						value={sort}
						onChange={(event) => setSort(event.target.value as "evidence" | "name")}
						className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[11px] font-bold text-[var(--muted-strong)]"
					>
						<option value="evidence">Nhiều nội dung nhất</option>
						<option value="name">Tên A-Z</option>
					</select>
					<PagePolicyFilter
						active={filter === "all"}
						label="Tất cả"
						onClick={() => setFilter("all")}
						value={pages.length}
					/>
					<PagePolicyFilter
						active={filter === "trusted"}
						label="Đáng tin"
						onClick={() => setFilter("trusted")}
						value={counts.trusted}
					/>
					<PagePolicyFilter
						active={filter === "neutral"}
						label="Trung lập"
						onClick={() => setFilter("neutral")}
						value={counts.neutral}
					/>
					<PagePolicyFilter
						active={filter === "at_risk"}
						label="Có rủi ro"
						onClick={() => setFilter("at_risk")}
						value={counts.at_risk}
					/>
					<PagePolicyFilter
						active={filter === "uncategorized"}
						label="Chưa phân loại"
						onClick={() => setFilter("uncategorized")}
						value={counts.uncategorized}
					/>
				</div>
			</div>

			{pagesQuery.isPending ? (
				<div className="grid min-h-48 place-items-center">
					<LoaderCircle className="animate-spin text-[var(--accent)]" />
				</div>
			) : pagesQuery.isError ? (
				<div className="p-8 text-center">
					<p className="text-sm font-bold text-[var(--danger-strong)]">
						Không thể tải danh sách trang.
					</p>
					<button
						type="button"
						onClick={() => void pagesQuery.refetch()}
						className="mt-3 text-xs font-bold text-[var(--accent-strong)]"
					>
						Thử lại
					</button>
				</div>
			) : filteredPages.length ? (
				<div className="divide-y divide-[var(--divider)]">
					{filteredPages.map((page) => (
						<FacebookPagePolicyRow
							key={page.pageKey}
							feedback={feedbackByPage[page.pageKey]}
							onDismissRun={() => scanRuns.dismiss(page.pageKey)}
							onSave={(patch) => savePolicy(page, patch)}
							onScanNow={() => scanNow(page)}
							page={page}
							run={scanRuns.runs[page.pageKey]}
							saving={savingKeys.has(page.pageKey)}
						/>
					))}
				</div>
			) : (
				<div className="p-10 text-center text-sm font-semibold text-[var(--muted)]">
					Không có trang phù hợp với bộ lọc.
				</div>
			)}
		</Panel>
	);
}

function FacebookPagePolicyRow({
	feedback,
	onDismissRun,
	onSave,
	onScanNow,
	page,
	run,
	saving,
}: {
	feedback?: PagePolicyFeedback;
	onDismissRun: () => void;
	onSave: (
		patch: Partial<
			Pick<IntelligenceFacebookPageOption, "autoDraftEnabled" | "classification">
		>,
	) => Promise<void>;
	onScanNow: () => Promise<void>;
	page: IntelligenceFacebookPageOption;
	run?: ReturnType<typeof useScanRuns>["runs"][string];
	saving: boolean;
}) {
	const automationUnavailable = page.classification === "uncategorized";
	const scanning = run ? !["completed", "failed"].includes(run.phase) : false;

	return (
		<div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] xl:items-start">
			<div className="min-w-0">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<p className="truncate text-[13px] font-extrabold text-[var(--foreground)]">
						{page.label}
					</p>
					<PageClassificationBadge classification={page.classification} />
				</div>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{page.username ? `@${page.username}` : "Chưa có địa chỉ trang"}
				</p>
				<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-[var(--muted)]">
					<span>{page.evidenceCount} bài đã thu thập</span>
					<span>{page.automation.pending} bản nháp đang chờ</span>
					<span>{page.automation.completed} đã soạn</span>
				</div>
				<button
					type="button"
					disabled={scanning}
					onClick={() => void onScanNow()}
					className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-[11px] font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-wait disabled:opacity-65"
				>
					{scanning ? (
						<LoaderCircle size={14} className="animate-spin" />
					) : (
						<Play size={14} />
					)}
					{scanning ? "Đang quét" : "Quét ngay"}
				</button>
				{run ? (
					<div className="mt-3">
						<ScanRunIndicator
							onDismiss={onDismissRun}
							run={run}
							timelineHref={`/evidence?sort=collected-desc&facebookPage=${encodeURIComponent(page.value)}`}
						/>
					</div>
				) : null}
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
					<span>Cách xử lý nội dung</span>
					<span>Chọn một</span>
				</div>
				<div
					className="grid grid-cols-2 gap-2 sm:grid-cols-4"
					aria-label={`Phân loại ${page.label}`}
				>
					<PagePolicyButton
						active={page.classification === "trusted"}
						disabled={saving}
						icon={ShieldCheck}
						label="Đáng tin"
						onClick={() => onSave({ autoDraftEnabled: true, classification: "trusted" })}
						tone="success"
					/>
					<PagePolicyButton
						active={page.classification === "neutral"}
						disabled={saving}
						icon={Scale}
						label="Trung lập"
						onClick={() => onSave({ autoDraftEnabled: true, classification: "neutral" })}
						tone="neutral"
					/>
					<PagePolicyButton
						active={page.classification === "at_risk"}
						disabled={saving}
						icon={ShieldAlert}
						label="Có rủi ro"
						onClick={() => onSave({ autoDraftEnabled: true, classification: "at_risk" })}
						tone="danger"
					/>
					<PagePolicyButton
						active={page.classification === "uncategorized"}
						disabled={saving}
						icon={Radar}
						label="Chưa rõ"
						onClick={() =>
							onSave({ autoDraftEnabled: false, classification: "uncategorized" })
						}
						tone="neutral"
					/>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={page.autoDraftEnabled && !automationUnavailable}
					aria-label={`Tự động soạn bản nháp cho ${page.label}`}
					disabled={saving || automationUnavailable}
					onClick={() => void onSave({ autoDraftEnabled: !page.autoDraftEnabled })}
					className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${
						page.autoDraftEnabled && !automationUnavailable
							? "border-[var(--accent)] bg-[var(--accent-soft)]"
							: "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
					}`}
				>
					<span className="min-w-0">
						<span className="block text-[11px] font-extrabold text-[var(--foreground)]">
							Tự động soạn bản nháp chờ duyệt
						</span>
						<span className="mt-0.5 block text-[10px] font-semibold leading-4 text-[var(--muted)]">
							{automationUnavailable
								? "Chọn cách xử lý ở trên để bật tính năng này."
								: "Chỉ tạo bản nháp nội bộ, không tự động đăng bài."}
						</span>
					</span>
					<span
						aria-hidden
						className={`relative inline-flex h-6 w-11 shrink-0 rounded-full p-0.5 transition ${
							page.autoDraftEnabled && !automationUnavailable
								? "bg-[var(--accent)]"
								: "bg-[var(--border-strong)]"
						}`}
					>
						<span
							className={`size-5 rounded-full bg-white shadow-sm transition ${
								page.autoDraftEnabled && !automationUnavailable
									? "translate-x-5"
									: "translate-x-0"
							}`}
						/>
					</span>
				</button>
				{feedback ? (
					<p
						aria-live="polite"
						className={`rounded-md border px-3 py-2 text-[10px] font-bold leading-4 ${
							feedback.tone === "error"
								? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-strong)]"
								: "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]"
						}`}
					>
						{feedback.message}
					</p>
				) : null}
			</div>
		</div>
	);
}

function PageClassificationBadge({
	classification,
}: {
	classification: FacebookPageClassification;
}) {
	const map = {
		at_risk: {
			className: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
			icon: ShieldAlert,
			label: "Có rủi ro",
		},
		neutral: {
			className: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
			icon: Scale,
			label: "Trung lập",
		},
		trusted: {
			className: "bg-[var(--success-soft)] text-[var(--success-strong)]",
			icon: ShieldCheck,
			label: "Đáng tin cậy",
		},
		uncategorized: {
			className: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]",
			icon: Radar,
			label: "Chưa phân loại",
		},
	}[classification];
	const Icon = map.icon;
	return (
		<span
			className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-bold ${map.className}`}
		>
			<Icon size={11} />
			{map.label}
		</span>
	);
}

function PagePolicyButton({
	active,
	disabled,
	icon: Icon,
	label,
	onClick,
	tone,
}: {
	active: boolean;
	disabled: boolean;
	icon: LucideIcon;
	label: string;
	onClick: () => void;
	tone: "danger" | "neutral" | "success";
}) {
	const activeClass =
		tone === "success"
			? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]"
			: tone === "danger"
				? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-strong)]"
				: "border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--foreground)]";
	return (
		<button
			type="button"
			aria-pressed={active}
			disabled={disabled}
			onClick={onClick}
			className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-55 ${
				active
					? activeClass
					: "border-[var(--border)] text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
			}`}
		>
			<Icon size={14} />
			{label}
		</button>
	);
}

function PagePolicyFilter({
	active,
	label,
	onClick,
	value,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
	value: number;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[11px] font-bold ${
				active
					? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
					: "border-[var(--border)] text-[var(--muted-strong)]"
			}`}
		>
			<span>{label}</span>
			<span className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px]">{value}</span>
		</button>
	);
}
