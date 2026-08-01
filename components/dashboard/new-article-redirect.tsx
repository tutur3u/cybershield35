"use client";

import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
	articleQueryKeys,
	fetchArticleJson,
} from "@/lib/articles/client-queries";

export function NewArticleRedirect() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const started = useRef(false);
	const createArticle = useMutation({
		mutationKey: [...articleQueryKeys.all, "create"],
		mutationFn: () =>
			fetchArticleJson<{ article: { id: string } }>("/api/articles", {
				body: JSON.stringify({
					author: "",
					blocks: [
						{ content: "", id: crypto.randomUUID(), type: "text" },
					],
					commentsEnabled: true,
					coverUrl: null,
					description: "",
					originDraftId: searchParams.get("draftId") ?? undefined,
					originEvidenceItemId:
						searchParams.get("evidenceId") ?? undefined,
					originScanJobId: searchParams.get("scanId") ?? undefined,
					title: "",
				}),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			}),
		onSuccess: ({ article }) => router.replace(`/articles/${article.id}`),
	});
	const { mutate } = createArticle;

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		mutate();
	}, [mutate]);
	const error =
		createArticle.error instanceof Error
			? createArticle.error.message
			: createArticle.error
				? "Không thể tạo bài viết."
				: "";

	return (
		<div className="grid min-h-[55vh] place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)]">
			<div className="text-center">
				{error ? (
					<>
						<p className="text-sm font-bold text-[var(--danger-strong)]">{error}</p>
						<button
							type="button"
							onClick={() => {
								createArticle.reset();
								mutate();
							}}
							className="mt-4 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-bold"
						>
							Thử tạo lại
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
