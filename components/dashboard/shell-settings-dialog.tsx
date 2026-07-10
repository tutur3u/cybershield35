"use client";

import { useEffect, useState } from "react";

import { Dialog } from "@/components/dashboard/dialog-frame";
import { ManagedSchedulerPanel } from "@/components/dashboard/managed-scheduler-panel";
import { ProviderStatus } from "@/components/dashboard/page-widgets";
import { Panel, PanelHeader } from "@/components/dashboard/ui-primitives";
import type { ProviderAvailabilityView } from "@/components/dashboard/types";

export function OperationalSettingsDialog({
	autoRetryToken,
	initialProviderAvailability,
	onClose,
}: {
	autoRetryToken?: number;
	initialProviderAvailability?: ProviderAvailabilityView | null;
	onClose: () => void;
}) {
	const [providerAvailability, setProviderAvailability] =
		useState<ProviderAvailabilityView | null>(
			initialProviderAvailability ?? null,
		);
	const [providerStatusError, setProviderStatusError] = useState("");
	const [providerStatusPending, setProviderStatusPending] = useState(
		() => !initialProviderAvailability,
	);

	useEffect(() => {
		const controller = new AbortController();

		void fetch("/api/health", {
			cache: "no-store",
			credentials: "same-origin",
			headers: { Accept: "application/json" },
			signal: controller.signal,
		})
			.then(async (response) => {
				if (!response.ok) {
					throw new Error("Không thể kiểm tra trạng thái provider.");
				}

				return (await response.json()) as {
					providers?: ProviderAvailabilityView;
				};
			})
			.then((payload) => {
				setProviderAvailability(payload.providers ?? null);
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setProviderStatusError(
					error instanceof Error
						? error.message
						: "Không thể kiểm tra trạng thái provider.",
				);
			})
			.finally(() => {
				if (!controller.signal.aborted) setProviderStatusPending(false);
			});

		return () => controller.abort();
	}, []);

	return (
		<Dialog
			open
			onClose={onClose}
			title="Cài đặt vận hành"
			description="Trạng thái provider và tự động hóa lịch quét."
			size="wide"
		>
			<div className="space-y-4">
				<ManagedSchedulerPanel autoRetryToken={autoRetryToken} />
				{providerStatusPending && !providerAvailability ? (
					<ProviderStatusSkeleton />
				) : (
					<ProviderStatus availability={providerAvailability ?? undefined} />
				)}
				{providerStatusError ? (
					<p
						className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-[12px] font-semibold text-[var(--warning-strong)]"
						role="status"
					>
						{providerStatusError}
					</p>
				) : null}
			</div>
		</Dialog>
	);
}

function ProviderStatusSkeleton() {
	return (
		<Panel>
			<PanelHeader
				title="Adapter provider"
				description="Đang kiểm tra cấu hình provider phía máy chủ."
			/>
			<div
				aria-label="Đang tải trạng thái provider"
				className="grid animate-pulse gap-3 p-4 sm:grid-cols-2"
			>
				{Array.from({ length: 4 }, (_, index) => (
					<div
						className="h-16 rounded-lg bg-[var(--surface-soft)]"
						key={index}
					/>
				))}
			</div>
		</Panel>
	);
}
