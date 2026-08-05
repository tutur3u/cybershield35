"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ArticleContent } from "@/lib/articles/schemas";
import { articleQueryKeys } from "@/lib/articles/client-queries";

import { useConfirmDialog } from "@/components/dashboard/confirm-dialog";

import { fetchJson } from "./shared";
import type {
	AiProposal,
	PublishStep,
	ZaloPublishTarget,
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
	// Workspace-level configuration changes rarely; caching it keeps the editor from
	// paying for two extra round trips on every open.
	const accounts = useQuery({
		gcTime: 30 * 60_000,
		queryFn: () => fetchJson<ZaloAccountsResponse>("/api/integrations/zalo/accounts"),
		queryKey: ["zalo", "accounts"],
		staleTime: 5 * 60_000,
	});
	const models = useQuery({
		gcTime: 60 * 60_000,
		queryFn: () =>
			fetchJson<{ defaultModel: string; models: string[] }>("/api/ai/models"),
		queryKey: ["ai", "models"],
		staleTime: 30 * 60_000,
	});

	const [draft, setDraft] = useState<ArticleContent | null>(null);
	const [targetOaConnectionId, setTargetOaConnectionId] = useState("");
	const [busy, setBusy] = useState("");
	const [notice, setNotice] = useState<EditorNotice>(null);
	const [publishStep, setPublishStep] = useState<PublishStep>(null);
	const [publishTarget, setPublishTarget] = useState<ZaloPublishTarget>("public");
	const [schedule, setSchedule] = useState("");
	const [aiInstruction, setAiInstruction] = useState("");
	const [tone, setTone] = useState("Điềm tĩnh, khách quan");
	const [voice, setVoice] = useState("Tự nhiên, gần gũi");
	const [editorialIntent, setEditorialIntent] =
		useState<EditorialIntent>("counter_argument");
	const [model, setModel] = useState("");
	const [proposal, setProposal] = useState<AiProposal | null>(null);
	// Product-owned confirmations rather than window.confirm, which blocks the
	// main thread and cannot be styled, translated, or exercised in a test.
	const { confirm, dialog: confirmDialog } = useConfirmDialog();
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
		setTargetOaConnectionId(article.targetOaConnectionId ?? "");
	}, [detail.data?.article]);

	// Auto-selection has to be its own effect. The hydration effect above returns
	// early once the article's contentHash is known, and the accounts query almost
	// always resolves after it — so folding the fallback in there meant the target
	// was usually left empty and the editor demanded a choice the author had only
	// one option for.
	useEffect(() => {
		if (targetOaConnectionId) return;
		const available = accounts.data?.accounts ?? [];
		// Prefer an explicitly default account, otherwise the only/first linked one:
		// a workspace with a single OA should never be asked to pick it.
		const fallback =
			available.find((account) => account.isDefault) ?? available[0];
		if (fallback) setTargetOaConnectionId(fallback.id);
	}, [accounts.data?.accounts, targetOaConnectionId]);

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

			// Withdrawing an approval while the article is live would leave a post on
			// the OA that CS35 no longer considers approved — the audience keeps
			// reading something the team has just decided is not ready. So the two
			// happen together, or not at all.
			const article = detail.data?.article;
			const liveOnZalo = article?.publicationStatus === "published";
			const revoking = status !== "approved";
			if (liveOnZalo && revoking) {
				if (
					!(await confirm({
						confirmLabel: "Gỡ và chuyển chờ duyệt",
						description:
							"Bài đang hiển thị công khai. Gỡ khỏi Zalo OA trước, rồi chuyển về chờ duyệt. Nội dung vẫn được giữ để đăng lại sau khi duyệt.",
						title: "Gỡ bài khỏi Zalo OA trước khi bỏ duyệt?",
						tone: "danger",
					}))
				) {
					return;
				}
				const withdrawn = await runAction("review", async () => {
					await fetchJson(`/api/articles/${articleId}/hide`, { method: "POST" });
				});
				if (!withdrawn) return;
			}

			await runAction("review", async () => {
				await fetchJson(`/api/articles/${articleId}/review`, {
					body: JSON.stringify({ status }),
					headers: { "Content-Type": "application/json" },
					method: "POST",
				});
				setNotice({
					text:
						status === "approved"
							? "Đã phê duyệt. Bài viết sẵn sàng đưa lên Zalo OA."
							: liveOnZalo
								? "Đã gỡ bài khỏi Zalo OA và chuyển về chờ duyệt."
								: "Đã chuyển bài về trạng thái chờ duyệt.",
					tone: "success",
				});
				await refresh();
			});
		},
		[articleId, confirm, detail.data?.article, dirty, refresh, runAction, save],
	);

	const publishAction = useCallback(
		async (action: "sync" | "publish" | "live-update" | "hide") => {
			if (dirty && !(await save())) return;
			const confirmed =
				action === "sync" ||
				(await confirm({
					confirmLabel:
						action === "publish"
							? "Xuất bản"
							: action === "hide"
								? "Ẩn bài"
								: "Cập nhật",
					description:
						action === "publish"
							? "Bài sẽ hiển thị công khai với người theo dõi Zalo OA ngay lập tức."
							: action === "hide"
								? "Nội dung vẫn được giữ trong CyberShield35 để có thể xuất bản lại."
								: "Bản đang hiển thị trên Zalo sẽ được thay bằng phiên bản hiện tại.",
					title:
						action === "publish"
							? "Xuất bản công khai trên Zalo OA?"
							: action === "hide"
								? "Ẩn bài khỏi Zalo OA?"
								: "Cập nhật bài đang hiển thị?",
					tone: action === "hide" ? "danger" : "default",
				}));
			if (!confirmed) return;
			await runAction(action, async () => {
				await fetchJson(`/api/articles/${articleId}/${action}`, { method: "POST" });
				setNotice({
					text:
						action === "sync"
							? "Đã đồng bộ bản ẩn. Kiểm tra bản xem trước trước khi xuất bản."
							: action === "publish"
								? "Bài đã hiển thị công khai trên Zalo OA."
								: action === "hide"
									? "Bài đã chuyển sang trạng thái ẩn trên Zalo OA."
									: "Đã cập nhật bài đang hiển thị trên Zalo OA.",
					tone: "success",
				});
				await refresh();
			});
		},
		[confirm, articleId, dirty, refresh, runAction, save],
	);

	/**
	 * Publishing means one thing to an operator: the article goes live on the Zalo
	 * Official Account. The three server steps that make that happen — mark it
	 * published in the catalog, push a hidden copy, then reveal it — run as a
	 * single action with the current step reported as it goes.
	 */
	const publish = useCallback(async () => {
		if (dirty && !(await save())) return;
		const goingPublic = publishTarget === "public";
		if (
			!(await confirm({
				confirmLabel: goingPublic ? "Đăng công khai" : "Đưa lên bản ẩn",
				description: goingPublic
					? "Bài sẽ hiển thị công khai với người theo dõi Zalo OA ngay lập tức."
					: "Chỉ quản trị viên OA nhìn thấy. Bài chưa hiển thị với người theo dõi.",
				title: goingPublic
					? "Đăng lên Zalo OA ngay bây giờ?"
					: "Đưa lên Zalo OA ở trạng thái ẩn?",
			}))
		) {
			return;
		}
		await runAction("publish", async () => {
			setPublishStep("preparing");
			await fetchJson(`/api/articles/${articleId}/publish-internal`, {
				method: "POST",
			});
			setPublishStep("syncing");
			await fetchJson(`/api/articles/${articleId}/sync`, { method: "POST" });
			if (goingPublic) {
				setPublishStep("publishing");
				await fetchJson(`/api/articles/${articleId}/publish`, { method: "POST" });
			}
			setPublishStep(null);
			setNotice({
				text: goingPublic
					? "Bài viết đã được đăng công khai trên Zalo OA."
					: "Bài viết đã lên Zalo OA ở trạng thái ẩn.",
				tone: "success",
			});
			await refresh();
		}).finally(() => setPublishStep(null));
	}, [confirm, articleId, dirty, publishTarget, refresh, runAction, save]);

	/**
	 * Preview path: pushes a hidden copy to Zalo without revealing it, so an editor
	 * can check the real rendering before going live.
	 */
	const syncPreview = useCallback(async () => {
		if (dirty && !(await save())) return;
		await runAction("sync", async () => {
			await fetchJson(`/api/articles/${articleId}/publish-internal`, {
				method: "POST",
			});
			await fetchJson(`/api/articles/${articleId}/sync`, { method: "POST" });
			setNotice({
				text: "Đã tạo bản xem trước ẩn trên Zalo OA. Bài chưa hiển thị công khai.",
				tone: "success",
			});
			await refresh();
		});
	}, [articleId, dirty, refresh, runAction, save]);

	/**
	 * Choosing a visibility used to set local state and nothing else, so on an
	 * article already staged on Zalo the click appeared to do nothing at all —
	 * no confirmation, no change, no indication it had been registered.
	 *
	 * When the article is already on the OA the choice *is* the action, so it
	 * runs the matching publish/hide rail. When it is not there yet there is
	 * nothing to apply, so it records the choice and says when it takes effect.
	 */
	const changePublishTarget = useCallback(
		async (next: ZaloPublishTarget) => {
			if (next === publishTarget) return;
			const status = detail.data?.article.publicationStatus;

			if (status !== "hidden" && status !== "published") {
				setPublishTarget(next);
				setNotice({
					text:
						next === "public"
							? "Đã chọn hiển thị công khai. Bấm nút đăng bên dưới để áp dụng."
							: "Đã chọn đưa lên ở trạng thái ẩn. Bấm nút đăng bên dưới để áp dụng.",
					tone: "info",
				});
				return;
			}

			await publishAction(next === "public" ? "publish" : "hide");
		},
		[detail.data?.article.publicationStatus, publishAction, publishTarget],
	);

	// Mirrors what Zalo actually holds, so the pair of buttons cannot drift from
	// the article's real visibility after a publish or hide lands.
	useEffect(() => {
		const status = detail.data?.article.publicationStatus;
		if (status === "published") setPublishTarget("public");
		else if (status === "hidden") setPublishTarget("hidden");
	}, [detail.data?.article.publicationStatus]);

	const schedulePublish = useCallback(async () => {
		if (!schedule) {
			setNotice({ text: "Hãy chọn ngày giờ xuất bản.", tone: "error" });
			return;
		}
		if (
			!(await confirm({
				confirmLabel: "Hẹn giờ",
				description:
					"Bài sẽ tự hiển thị công khai vào thời điểm này mà không cần thao tác thêm.",
				title: `Tự động xuất bản lúc ${new Date(schedule).toLocaleString("vi-VN")}?`,
			}))
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
	}, [confirm, articleId, refresh, runAction, schedule]);

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
			!(await confirm({
				confirmLabel: "Xóa khỏi Zalo",
				description:
					"Nội dung trong CyberShield35 vẫn được giữ lại để chỉnh sửa hoặc đồng bộ lại.",
				title: "Xóa bản này khỏi Zalo OA?",
				tone: "danger",
			}))
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
	}, [confirm, articleId, refresh, runAction]);

	const deleteLocalArticle = useCallback(async () => {
		if (
			!(await confirm({
				confirmLabel: "Xóa vĩnh viễn",
				description: "Thao tác này không thể hoàn tác.",
				title: "Xóa vĩnh viễn bài viết này?",
				tone: "danger",
			}))
		) {
			return;
		}
		await runAction("article:delete", async () => {
			await fetchJson(`/api/articles/${articleId}`, { method: "DELETE" });
			router.push("/articles");
		});
	}, [confirm, articleId, router, runAction]);

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
			if (
				!(await confirm({
					confirmLabel: "Khôi phục",
					description:
						"Nội dung hiện tại sẽ được thay bằng phiên bản này. Bản hiện tại vẫn được lưu trong lịch sử.",
					title: "Khôi phục phiên bản này?",
				}))
			) {
				return;
			}
			await runAction("restore", async () => {
				await fetchJson(
					`/api/articles/${articleId}/versions/${versionId}/restore`,
					{ method: "POST" },
				);
				setNotice({ text: "Đã khôi phục phiên bản.", tone: "success" });
				await refresh();
			});
		},
		[confirm, articleId, refresh, runAction],
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
		confirmDialog,
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
		publishStep,
		publishTarget,
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
		changePublishTarget,
		setPublishTarget,
		syncPreview,
		setSchedule,
		setTargetOaConnectionId,
		setTone,
		setVoice,
		targetOaConnectionId,
		tone,
		voice,
	};
}
