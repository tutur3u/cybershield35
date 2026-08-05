"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ArticleContent } from "@/lib/articles/schemas";
import { articleQueryKeys } from "@/lib/articles/client-queries";

import { fetchJson } from "./shared";
import type {
	AiProposal,
	ArticleDetail,
	EditorialIntent,
	EditorNotice,
	ZaloAccount,
} from "./types";

type ZaloAccountsResponse = {
	accounts: ZaloAccount[];
	configured: boolean;
	enabled: boolean;
};

/**
 * Owns every server interaction for the editor so the view layer stays declarative.
 */
export function useArticleEditor(articleId: string) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const detail = useQuery({
		queryKey: articleQueryKeys.detail(articleId),
		queryFn: () => fetchJson<ArticleDetail>(`/api/articles/${articleId}`),
		refetchInterval: (query) =>
			["syncing", "publishing"].includes(
				query.state.data?.article.publicationStatus ?? "",
			)
				? 1_500
				: false,
	});
	const accounts = useQuery({
		queryKey: ["zalo", "accounts"],
		queryFn: () => fetchJson<ZaloAccountsResponse>("/api/integrations/zalo/accounts"),
	});
	const models = useQuery({
		queryKey: ["ai", "models"],
		queryFn: () =>
			fetchJson<{ defaultModel: string; models: string[] }>("/api/ai/models"),
	});

	const [draft, setDraft] = useState<ArticleContent | null>(null);
	const [targetOaConnectionId, setTargetOaConnectionId] = useState("");
	const [busy, setBusy] = useState("");
	const [notice, setNotice] = useState<EditorNotice>(null);
	const [publishToZalo, setPublishToZalo] = useState(false);
	const [schedule, setSchedule] = useState("");
	const [aiInstruction, setAiInstruction] = useState("");
	const [tone, setTone] = useState("Điềm tĩnh, khách quan");
	const [voice, setVoice] = useState("Tự nhiên, gần gũi");
	const [editorialIntent, setEditorialIntent] =
		useState<EditorialIntent>("counter_argument");
	const [model, setModel] = useState("");
	const [proposal, setProposal] = useState<AiProposal | null>(null);
	const hydratedHash = useRef("");

	useEffect(() => {
		const article = detail.data?.article;
		if (!article || hydratedHash.current === article.contentHash) return;
		hydratedHash.current = article.contentHash;
		setDraft({
			author: article.author,
			blocks: article.blocks,
			commentsEnabled: article.commentsEnabled,
			coverUrl: article.coverUrl,
			description: article.description,
			title: article.title,
		});
		setTargetOaConnectionId(
			article.targetOaConnectionId ??
				accounts.data?.accounts.find((account) => account.isDefault)?.id ??
				"",
		);
	}, [accounts.data?.accounts, detail.data?.article]);

	const dirty = useMemo(() => {
		if (!draft || !detail.data) return false;
		const article = detail.data.article;
		return (
			JSON.stringify(draft) !==
				JSON.stringify({
					author: article.author,
					blocks: article.blocks,
					commentsEnabled: article.commentsEnabled,
					coverUrl: article.coverUrl,
					description: article.description,
					title: article.title,
				}) || targetOaConnectionId !== (article.targetOaConnectionId ?? "")
		);
	}, [detail.data, draft, targetOaConnectionId]);

	const refresh = useCallback(async () => {
		await Promise.all([
			detail.refetch(),
			queryClient.invalidateQueries({ queryKey: articleQueryKeys.all }),
		]);
	}, [detail, queryClient]);

	const runAction = useCallback(
		async (key: string, action: () => Promise<unknown>) => {
			setBusy(key);
			setNotice(null);
			try {
				await action();
				return true;
			} catch (error) {
				setNotice({
					text:
						error instanceof Error ? error.message : "Thao tác không thành công.",
					tone: "error",
				});
				return false;
			} finally {
				setBusy("");
			}
		},
		[],
	);

	const save = useCallback(async () => {
		if (!draft) return false;
		return runAction("save", async () => {
			await fetchJson(`/api/articles/${articleId}`, {
				body: JSON.stringify({
					...draft,
					targetOaConnectionId: targetOaConnectionId || null,
				}),
				headers: { "Content-Type": "application/json" },
				method: "PATCH",
			});
			setNotice({ text: "Đã lưu phiên bản mới.", tone: "success" });
			await refresh();
		});
	}, [articleId, draft, refresh, runAction, targetOaConnectionId]);

	const review = useCallback(
		async (status: string) => {
			if (dirty && !(await save())) return;
			await runAction("review", async () => {
				await fetchJson(`/api/articles/${articleId}/review`, {
					body: JSON.stringify({ status }),
					headers: { "Content-Type": "application/json" },
					method: "POST",
				});
				setNotice({
					text:
						status === "approved"
							? "Đã phê duyệt. Bài viết sẵn sàng đồng bộ bản ẩn lên Zalo OA."
							: "Đã chuyển bài về trạng thái chờ duyệt.",
					tone: "success",
				});
				await refresh();
			});
		},
		[articleId, dirty, refresh, runAction, save],
	);

	const publishAction = useCallback(
		async (action: "sync" | "publish" | "live-update" | "hide") => {
			if (dirty && !(await save())) return;
			const confirmed =
				action === "sync" ||
				window.confirm(
					action === "publish"
						? "Xuất bản bài viết này công khai trên Zalo OA ngay bây giờ?"
						: action === "hide"
							? "Ẩn bài viết này khỏi Zalo OA? Nội dung vẫn được giữ để có thể xuất bản lại."
							: "Cập nhật bài viết đang hiển thị trên Zalo bằng phiên bản hiện tại?",
				);
			if (!confirmed) return;
			await runAction(action, async () => {
				await fetchJson(`/api/articles/${articleId}/${action}`, { method: "POST" });
				setNotice({
					text:
						action === "sync"
							? "Đã đồng bộ bản ẩn. Kiểm tra bản xem trước trước khi xuất bản."
							: "Đã hoàn tất thao tác với Zalo OA.",
					tone: "success",
				});
				await refresh();
			});
		},
		[articleId, dirty, refresh, runAction, save],
	);

	const publish = useCallback(async () => {
		if (dirty && !(await save())) return;
		await runAction("publish", async () => {
			await fetchJson(`/api/articles/${articleId}/publish-internal`, {
				method: "POST",
			});
			if (publishToZalo) {
				await fetchJson(`/api/articles/${articleId}/sync`, { method: "POST" });
				await fetchJson(`/api/articles/${articleId}/publish`, { method: "POST" });
			}
			setNotice({
				text: publishToZalo
					? "Bài viết đã được xuất bản và đăng lên Zalo OA."
					: "Bài viết đã được xuất bản nội bộ.",
				tone: "success",
			});
			await refresh();
		});
	}, [articleId, dirty, publishToZalo, refresh, runAction, save]);

	const schedulePublish = useCallback(async () => {
		if (!schedule) {
			setNotice({ text: "Hãy chọn ngày giờ xuất bản.", tone: "error" });
			return;
		}
		if (
			!window.confirm(
				`Xác nhận tự động xuất bản lúc ${new Date(schedule).toLocaleString("vi-VN")}?`,
			)
		) {
			return;
		}
		await runAction("schedule", async () => {
			await fetchJson(`/api/articles/${articleId}/schedule`, {
				body: JSON.stringify({ scheduledAt: new Date(schedule).toISOString() }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			setNotice({
				text: "Đã lên lịch xuất bản. Bạn có thể hủy trước thời điểm chạy.",
				tone: "success",
			});
			await refresh();
		});
	}, [articleId, refresh, runAction, schedule]);

	const cancelSchedule = useCallback(async () => {
		await runAction("cancel", async () => {
			await fetchJson(`/api/articles/${articleId}/schedule`, { method: "DELETE" });
			setNotice({ text: "Đã hủy lịch xuất bản.", tone: "success" });
			await refresh();
		});
	}, [articleId, refresh, runAction]);

	const refreshFromZalo = useCallback(async () => {
		await runAction("remote:refresh", async () => {
			await fetchJson(`/api/articles/${articleId}/remote`, { method: "POST" });
			setNotice({ text: "Đã làm mới trạng thái từ Zalo OA.", tone: "success" });
			await refresh();
		});
	}, [articleId, refresh, runAction]);

	const removeFromZalo = useCallback(async () => {
		if (
			!window.confirm(
				"Xóa bản này khỏi Zalo OA? Nội dung trong CyberShield35 vẫn được giữ lại để chỉnh sửa hoặc đồng bộ lại.",
			)
		) {
			return;
		}
		await runAction("remote:remove", async () => {
			await fetchJson(`/api/articles/${articleId}/remote`, { method: "DELETE" });
			setNotice({
				text: "Đã xóa bản trên Zalo. Nội dung trong CyberShield35 vẫn được giữ.",
				tone: "success",
			});
			await refresh();
		});
	}, [articleId, refresh, runAction]);

	const deleteLocalArticle = useCallback(async () => {
		if (
			!window.confirm(
				"Xóa vĩnh viễn bài viết này? Thao tác này không thể hoàn tác.",
			)
		) {
			return;
		}
		await runAction("article:delete", async () => {
			await fetchJson(`/api/articles/${articleId}`, { method: "DELETE" });
			router.push("/articles");
		});
	}, [articleId, router, runAction]);

	const askAi = useCallback(
		async (action: string) => {
			if (dirty && !(await save())) return;
			await runAction(`ai:${action}`, async () => {
				const result = await fetchJson<{ proposal: AiProposal }>(
					`/api/articles/${articleId}/ai`,
					{
						body: JSON.stringify({
							action,
							editorialIntent,
							instruction: aiInstruction || undefined,
							model: model || models.data?.defaultModel || undefined,
							tone,
							voice,
						}),
						headers: { "Content-Type": "application/json" },
						method: "POST",
					},
				);
				setProposal(result.proposal);
				setNotice({
					text: "AI đã tạo đề xuất. So sánh rồi chọn Áp dụng hoặc Bỏ qua.",
					tone: "success",
				});
			});
		},
		[
			aiInstruction,
			articleId,
			dirty,
			editorialIntent,
			model,
			models.data?.defaultModel,
			runAction,
			save,
			tone,
			voice,
		],
	);

	const applyProposal = useCallback(async () => {
		if (!proposal) return;
		await runAction("ai:apply", async () => {
			await fetchJson(`/api/articles/${articleId}/ai/apply`, {
				body: JSON.stringify({
					content: {
						author: proposal.author,
						blocks: proposal.blocks,
						commentsEnabled: proposal.commentsEnabled,
						coverUrl: proposal.coverUrl,
						description: proposal.description,
						title: proposal.title,
					},
					instruction: aiInstruction || "Đề xuất biên tập bằng AI",
				}),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			setProposal(null);
			setNotice({
				text: "Đã áp dụng đề xuất và lưu một phiên bản có thể khôi phục.",
				tone: "success",
			});
			await refresh();
		});
	}, [aiInstruction, articleId, proposal, refresh, runAction]);

	const restore = useCallback(
		async (versionId: string) => {
			if (!window.confirm("Khôi phục phiên bản này thành nội dung hiện tại?")) return;
			await runAction("restore", async () => {
				await fetchJson(
					`/api/articles/${articleId}/versions/${versionId}/restore`,
					{ method: "POST" },
				);
				setNotice({ text: "Đã khôi phục phiên bản.", tone: "success" });
				await refresh();
			});
		},
		[articleId, refresh, runAction],
	);

	const dropCover = useCallback(() => {
		setDraft((current) =>
			current?.coverUrl ? { ...current, coverUrl: null } : current,
		);
	}, []);

	const dropImageBlock = useCallback((blockId: string) => {
		setDraft((current) =>
			current
				? { ...current, blocks: current.blocks.filter((block) => block.id !== blockId) }
				: current,
		);
	}, []);

	return {
		accounts,
		aiInstruction,
		applyProposal,
		askAi,
		busy,
		cancelSchedule,
		deleteLocalArticle,
		detail,
		dirty,
		draft,
		dropCover,
		dropImageBlock,
		editorialIntent,
		model,
		models,
		notice,
		proposal,
		publish,
		publishAction,
		publishToZalo,
		refreshFromZalo,
		removeFromZalo,
		restore,
		review,
		save,
		schedule,
		schedulePublish,
		setAiInstruction,
		setDraft,
		setEditorialIntent,
		setModel,
		setNotice,
		setProposal,
		setPublishToZalo,
		setSchedule,
		setTargetOaConnectionId,
		setTone,
		setVoice,
		targetOaConnectionId,
		tone,
		voice,
	};
}
