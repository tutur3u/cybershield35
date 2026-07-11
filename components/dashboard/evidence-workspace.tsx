"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";

import { DeferredDialogLoading } from "@/components/dashboard/deferred-dialog-loading";
import type { EvidenceFormValues } from "@/components/dashboard/dialogs";
import { EvidencePage } from "@/components/dashboard/evidence-page";
import type { ScanDetail } from "@/components/dashboard/types";
import { dashboardInitialDataQueryOptions } from "@/lib/dashboard/client-queries";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";

const EvidenceEditDialog = dynamic(
	() =>
		import("@/components/dashboard/dialogs").then(
			(module) => module.EvidenceEditDialog,
		),
	{ loading: () => <DeferredDialogLoading />, ssr: false },
);

const scanQueryParams = {
	includeDetail: false,
	includeScans: true,
	includeTrackedSources: false,
} as const;

export function EvidenceWorkspace() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [scanId, setScanId] = useState("");
	const [, setDetail] = useState<ScanDetail | null>(null);
	const [notice, setNotice] = useState("");

	async function openEvidenceDialog() {
		setNotice("");
		try {
			const snapshot = await queryClient.fetchQuery(
				dashboardInitialDataQueryOptions(scanQueryParams),
			);
			if (!snapshot.selectedScanId) {
				setNotice("Chưa có scan để thêm bằng chứng.");
				return;
			}
			setScanId(snapshot.selectedScanId);
			setDialogOpen(true);
		} catch (error) {
			setNotice(
				error instanceof Error
					? error.message
					: "Không thể tải scan để thêm bằng chứng.",
			);
		}
	}

	return (
		<>
			<EvidencePage onCreateEvidence={() => void openEvidenceDialog()} />
			<p className="sr-only" aria-live="polite">
				{notice}
			</p>
			{dialogOpen ? (
				<EvidenceEditDialog
					open
					onClose={() => setDialogOpen(false)}
					evidence={null}
					scanId={scanId}
					onSubmit={async (values: EvidenceFormValues) => {
						const { createEvidenceRecord } = await import(
							"@/components/dashboard/client-actions"
						);
						const success = await createEvidenceRecord({
							scanId,
							setDetail,
							setNotice,
							values,
						});
						if (success) {
							void queryClient.invalidateQueries({
								queryKey: dashboardQueryKeys.all,
								refetchType: "active",
							});
						}
						return success;
					}}
				/>
			) : null}
		</>
	);
}
