"use client";

import {
	CheckCircle2,
	Edit3,
	ExternalLink,
	Play,
	Plus,
	Power,
	Search,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { TrackedSourceView } from "@/components/dashboard/types";
import {
	DashboardTooltip,
	Panel,
	PanelHeader,
} from "@/components/dashboard/ui-primitives";

import { ScanRunIndicator } from "./scan-run-indicator";
import {
	facebookIdentity,
	formatDate,
	scanStatusLabel,
	sourceAutomationState,
	sourceKindLabel,
	type SourceAutomationState,
	type SourceFilterKey,
} from "./source-utils";
import { useScanRuns } from "./use-scan-runs";

export function TrackedSourcesPanel({
	isCreating,
	onCreateTrackedSource,
	onDeleteTrackedSource,
	onUpdateTrackedSource,
	sources,
}: {
	isCreating: boolean;
	onCreateTrackedSource: (input: {
		displayName: string;
		url: string;
	}) => Promise<boolean>;
	onDeleteTrackedSource: (source: TrackedSourceView) => Promise<boolean>;
	onUpdateTrackedSource: (
		source: TrackedSourceView,
		input: { displayName?: string; isActive?: boolean },
	) => Promise<boolean>;
	sources: TrackedSourceView[];
}) {
	const scanRuns = useScanRuns();
	const [displayName, setDisplayName] = useState("");
	const [editingName, setEditingName] = useState("");
	const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [sourceFilter, setSourceFilter] = useState<SourceFilterKey>("all");
	const [url, setUrl] = useState("");
	const [createError, setCreateError] = useState("");
	const sourceStates = useMemo(
		() => sources.map((source) => ({ source, state: sourceAutomationState(source) })),
		[sources],
	);
	const filteredSourceStates = sourceStates.filter((item) => {
		const normalizedQuery = query.trim().toLowerCase();
		const identity = facebookIdentity(item.source);
		const matchesQuery =
			!normalizedQuery ||
			item.source.displayName.toLowerCase().includes(normalizedQuery) ||
			item.source.normalizedUrl.toLowerCase().includes(normalizedQuery) ||
			identity.username?.toLowerCase().includes(normalizedQuery);
		if (!matchesQuery) return false;
		if (sourceFilter === "active") return item.source.isActive;
		if (sourceFilter === "due")
			return ["due", "stale_active"].includes(item.state.kind);
		if (sourceFilter === "paused") return !item.source.isActive;
		return true;
	});
	const dueCount = sourceStates.filter((item) =>
		["due", "stale_active"].includes(item.state.kind),
	).length;
	const activeCount = sourceStates.filter((item) => item.source.isActive).length;

	async function startScan(source: TrackedSourceView) {
		await scanRuns.start(source.id, async () => {
			const response = await fetch(`/api/tracked-sources/${source.id}/scan`, {
				body: JSON.stringify({ enqueueOnly: true }),
				cache: "no-store",
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			const payload = await response.json().catch(() => null);
			if (!response.ok) throw new Error(payload?.error ?? "Không thể quét nguồn này.");
			return { scanId: String(payload.scan.scanId) };
		});
	}

	async function createAndScan() {
		if (!url.trim()) {
			setCreateError("Hãy dán địa chỉ trang hoặc website cần theo dõi.");
			return;
		}
		setCreateError("");
		const created = await onCreateTrackedSource({ displayName, url });
		if (!created) {
			setCreateError("Không thêm được nguồn. Kiểm tra lại địa chỉ và thử lần nữa.");
			return;
		}
		setDisplayName("");
		setUrl("");
	}

	async function saveSourceName(source: TrackedSourceView) {
		if (!editingName.trim()) return;
		const saved = await onUpdateTrackedSource(source, {
			displayName: editingName.trim(),
		});
		if (saved) {
			setEditingSourceId(null);
			setEditingName("");
		}
	}

	return (
		<Panel>
			<PanelHeader
				title="Nguồn theo dõi"
				description="Trang và website công khai được quét lại mỗi ngày khi đang bật."
			/>

			<div className="border-b border-[var(--border)] bg-[var(--surface-soft)] p-4">
				<p className="text-[12px] font-bold text-[var(--foreground)]">Thêm nguồn mới</p>
				<div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_auto]">
					<input
						value={url}
						onChange={(event) => setUrl(event.target.value)}
						placeholder="https://facebook.com/ten-trang"
						className={inputClass}
					/>
					<input
						value={displayName}
						onChange={(event) => setDisplayName(event.target.value)}
						placeholder="Tên hiển thị (không bắt buộc)"
						className={inputClass}
					/>
					<button
						type="button"
						disabled={isCreating}
						onClick={() => void createAndScan()}
						className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-[12px] font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
					>
						<Plus size={15} /> Thêm nguồn
					</button>
				</div>
				{createError ? (
					<p className="mt-2 text-[11px] font-bold text-[var(--danger-strong)]">
						{createError}
					</p>
				) : (
					<p className="mt-2 text-[11px] font-semibold text-[var(--muted)]">
						Sau khi thêm, bấm “Quét ngay” để lấy nội dung mới và theo dõi tiến trình
						ngay tại đây.
					</p>
				)}
			</div>

			<div className="grid gap-3 border-b border-[var(--border)] p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
				<label className="relative min-w-0">
					<Search
						size={15}
						className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
					/>
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Tìm theo tên trang hoặc địa chỉ…"
						className={`${inputClass} pl-9`}
					/>
				</label>
				<div className="flex min-w-0 flex-wrap gap-2">
					<SourceFilterButton
						active={sourceFilter === "all"}
						label="Tất cả"
						onClick={() => setSourceFilter("all")}
						value={sources.length}
					/>
					<SourceFilterButton
						active={sourceFilter === "active"}
						label="Đang bật"
						onClick={() => setSourceFilter("active")}
						value={activeCount}
					/>
					<SourceFilterButton
						active={sourceFilter === "due"}
						label="Đến hạn quét"
						onClick={() => setSourceFilter("due")}
						value={dueCount}
					/>
					<SourceFilterButton
						active={sourceFilter === "paused"}
						label="Đã tắt"
						onClick={() => setSourceFilter("paused")}
						value={sources.length - activeCount}
					/>
				</div>
			</div>

			<div className="divide-y divide-[var(--divider)]">
				{filteredSourceStates.length ? (
					filteredSourceStates.map(({ source, state }) => {
						const identity = facebookIdentity(source);
						const run = scanRuns.runs[source.id];
						const scanning = run
							? !["completed", "failed"].includes(run.phase)
							: false;
						return (
							<div key={source.id} className="px-4 py-3">
								<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(160px,0.42fr)_auto] xl:items-center">
									<div className="min-w-0">
										{editingSourceId === source.id ? (
											<div className="flex gap-2">
												<input
													value={editingName}
													onChange={(event) => setEditingName(event.target.value)}
													className={`${inputClass} h-9 flex-1`}
												/>
												<button
													type="button"
													onClick={() => void saveSourceName(source)}
													className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
													aria-label="Lưu tên nguồn"
												>
													<CheckCircle2 size={15} />
												</button>
											</div>
										) : (
											<div className="flex min-w-0 flex-wrap items-center gap-2">
												<p className="min-w-0 truncate text-[13px] font-bold text-[var(--foreground)]">
													{source.displayName}
												</p>
												<ActiveBadge isActive={source.isActive} />
												<SourceStateBadge state={state} />
											</div>
										)}
										<a
											href={source.normalizedUrl}
											target="_blank"
											rel="noreferrer"
											className="mt-1 inline-flex max-w-full items-center gap-1 text-[11px] font-semibold text-[var(--muted)] transition hover:text-[var(--accent-strong)]"
										>
											<span className="truncate">
												{identity.username
													? `@${identity.username}`
													: source.normalizedUrl}
											</span>
											<ExternalLink size={12} className="shrink-0" />
										</a>
									</div>
									<div className="min-w-0 text-[11px] font-semibold text-[var(--muted)] xl:text-right">
										<p className="truncate">{sourceKindLabel(source.provider)}</p>
										<p className="mt-1 truncate">
											{source.lastScanStatus
												? `Lần quét gần nhất: ${scanStatusLabel(source.lastScanStatus)}`
												: "Chưa từng quét"}
										</p>
										<p className="mt-1 truncate">{formatDate(source.lastScannedAt)}</p>
									</div>
									<div className="flex flex-wrap justify-start gap-2 xl:justify-end">
										<button
											type="button"
											disabled={scanning || !source.isActive}
											onClick={() => void startScan(source)}
											className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-[12px] font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
										>
											<Play size={14} /> {scanning ? "Đang quét" : "Quét ngay"}
										</button>
										<DashboardTooltip
											content={
												source.isActive
													? "Tắt quét lại tự động hằng ngày"
													: "Bật quét lại tự động hằng ngày"
											}
										>
											<button
												type="button"
												onClick={() =>
													void onUpdateTrackedSource(source, {
														isActive: !source.isActive,
													})
												}
												className={iconButtonClass}
												aria-label={source.isActive ? "Tắt nguồn" : "Bật nguồn"}
											>
												<Power size={14} />
											</button>
										</DashboardTooltip>
										<DashboardTooltip content="Đổi tên hiển thị">
											<button
												type="button"
												onClick={() => {
													setEditingSourceId(source.id);
													setEditingName(source.displayName);
												}}
												className={iconButtonClass}
												aria-label="Đổi tên nguồn"
											>
												<Edit3 size={14} />
											</button>
										</DashboardTooltip>
										<DashboardTooltip content="Xóa nguồn khỏi danh sách theo dõi">
											<button
												type="button"
												onClick={() => void onDeleteTrackedSource(source)}
												className="grid size-9 place-items-center rounded-lg border border-[var(--danger-border)] text-[var(--danger-strong)] transition hover:bg-[var(--danger-soft)]"
												aria-label="Xóa nguồn"
											>
												<Trash2 size={14} />
											</button>
										</DashboardTooltip>
									</div>
								</div>
								{run ? (
									<div className="mt-3">
										<ScanRunIndicator
											onDismiss={() => scanRuns.dismiss(source.id)}
											run={run}
										/>
									</div>
								) : null}
							</div>
						);
					})
				) : (
					<p className="px-4 py-6 text-[12px] font-semibold text-[var(--muted)]">
						{sources.length
							? "Không có nguồn phù hợp bộ lọc hiện tại."
							: "Chưa có nguồn nào. Thêm một trang ở phía trên để bắt đầu."}
					</p>
				)}
			</div>
		</Panel>
	);
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
	return (
		<span
			className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-bold ${
				isActive
					? "bg-[var(--success-soft)] text-[var(--success-strong)]"
					: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]"
			}`}
		>
			<Power size={11} />
			{isActive ? "Đang theo dõi" : "Đã tắt"}
		</span>
	);
}

function SourceStateBadge({ state }: { state: SourceAutomationState }) {
	const styles = {
		accent: "border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]",
		neutral: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-strong)]",
		success: "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]",
		warning: "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
	};
	return (
		<DashboardTooltip content={state.help}>
			<span
				className={`inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-[10px] font-bold ${styles[state.tone]}`}
			>
				{state.label}
			</span>
		</DashboardTooltip>
	);
}

function SourceFilterButton({
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
			className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[12px] font-bold transition ${
				active
					? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
					: "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
			}`}
		>
			{label}
			<span className="rounded bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[10px]">
				{value.toLocaleString("vi-VN")}
			</span>
		</button>
	);
}

const inputClass =
	"h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]";
const iconButtonClass =
	"grid size-9 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]";
