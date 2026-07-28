"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NewArticleRedirect() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const started = useRef(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		void fetch("/api/articles", {
			body: JSON.stringify({
				author: "",
				blocks: [
					{ content: "", id: crypto.randomUUID(), type: "text" },
				],
				commentsEnabled: true,
				coverUrl: null,
				description: "",
				originDraftId: searchParams.get("draftId") ?? undefined,
				originEvidenceItemId: searchParams.get("evidenceId") ?? undefined,
				originScanJobId: searchParams.get("scanId") ?? undefined,
				title: "",
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		})
			.then(async (response) => {
				const body = await response.json().catch(() => null);
				if (!response.ok) throw new Error(body?.error ?? "Không thể tạo bài viết.");
				router.replace(`/articles/${body.article.id}`);
			})
			.catch((caught) =>
				setError(caught instanceof Error ? caught.message : "Không thể tạo bài viết."),
			);
	}, [router, searchParams]);

	return (
		<div className="grid min-h-[55vh] place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)]">
			<div className="text-center">
				{error ? (
					<>
						<p className="text-sm font-bold text-[var(--danger-strong)]">{error}</p>
						<button
							type="button"
							onClick={() => router.replace("/articles")}
							className="mt-4 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-bold"
						>
							Quay lại danh sách
						</button>
					</>
				) : (
					<>
						<LoaderCircle
							size={28}
							className="mx-auto animate-spin text-[var(--brand)]"
						/>
						<p className="mt-3 text-sm font-bold">Đang chuẩn bị không gian biên tập…</p>
					</>
				)}
			</div>
		</div>
	);
}
