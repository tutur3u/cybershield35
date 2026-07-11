"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";

import { composerOptions } from "@/components/dashboard/dashboard-data";
import { DeferredDialogLoading } from "@/components/dashboard/deferred-dialog-loading";
import { TopicsPage } from "@/components/dashboard/topics-page";
import type { DraftShape } from "@/components/dashboard/types";
import { dashboardInitialDataQueryOptions } from "@/lib/dashboard/client-queries";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";

const CounterArgumentDialog = dynamic(
	() =>
		import("@/components/dashboard/dialogs").then(
			(module) => module.CounterArgumentDialog,
		),
	{ loading: () => <DeferredDialogLoading />, ssr: false },
);

const scanQueryParams = {
	includeDetail: false,
	includeScans: true,
	includeTrackedSources: false,
} as const;

export function TopicsWorkspace() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [scanId, setScanId] = useState("");
	const [isDrafting, setIsDrafting] = useState(false);
	const [, setDraft] = useState<DraftShape | null>(null);
	const [notice, setNotice] = useState("");
	const [tone, setTone] = useState(
		composerOptions.tones[0] ?? "Điềm tĩnh, khách quan",
	);
	const [audience, setAudience] = useState(
		composerOptions.audiences[0] ?? "Công chúng chung",
	);
	const [language, setLanguage] = useState(
		composerOptions.languages[0] ?? "Tiếng Việt",
	);
	const [length, setLength] = useState(
		composerOptions.lengths[1] ?? "Trung bình",
	);
	const [operatorNotes, setOperatorNotes] = useState("");

	async function openDraftDialog() {
		setNotice("");
		try {
			const snapshot = await queryClient.fetchQuery(
				dashboardInitialDataQueryOptions(scanQueryParams),
			);
			if (!snapshot.selectedScanId) {
				setNotice("Chưa có scan để tạo bản nháp phản hồi.");
				return;
			}
			setScanId(snapshot.selectedScanId);
			setDialogOpen(true);
		} catch (error) {
			setNotice(
				error instanceof Error
					? error.message
					: "Không thể tải scan để tạo bản nháp phản hồi.",
			);
		}
	}

	return (
		<>
			<TopicsPage onOpenDraft={() => void openDraftDialog()} />
			<p className="sr-only" aria-live="polite">
				{notice}
			</p>
			{dialogOpen ? (
				<CounterArgumentDialog
					open
					onClose={() => setDialogOpen(false)}
					tone={tone}
					setTone={setTone}
					audience={audience}
					setAudience={setAudience}
					language={language}
					setLanguage={setLanguage}
					length={length}
					setLength={setLength}
					operatorNotes={operatorNotes}
					setOperatorNotes={setOperatorNotes}
					isDrafting={isDrafting}
					onGenerate={async () => {
						const { generateDraft } = await import(
							"@/components/dashboard/client-actions"
						);
						const success = await generateDraft({
							audience,
							language,
							length,
							operatorNotes,
							selectedScanId: scanId,
							setDraft,
							setIsDrafting,
							setNotice,
							tone,
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
