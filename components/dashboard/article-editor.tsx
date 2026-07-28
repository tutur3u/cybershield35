"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowDown,
	ArrowLeft,
	ArrowUp,
	Bot,
	CalendarClock,
	Check,
	ChevronRight,
	Clock3,
	ExternalLink,
	Eye,
	FileClock,
	ImagePlus,
	LoaderCircle,
	Plus,
	Radio,
	RefreshCw,
	Save,
	Send,
	Sparkles,
	Trash2,
	Type,
	Undo2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ArticleBlock, ArticleContent } from "@/lib/articles/schemas";
import { ExportActions } from "@/components/dashboard/export-actions";

type ArticleRow = ArticleContent & {
	contentHash: string;
	createdAt: string;
	id: string;
	lastError: string | null;
	lastSyncedAt: string | null;
	publicationStatus: string;
	publishedAt: string | null;
	remoteArticleId: string | null;
	remoteSnapshot: Record<string, unknown>;
	reviewStatus: string;
	scheduledAt: string | null;
	syncedContentHash: string | null;
	targetOaConnectionId: string | null;
	updatedAt: string;
};

type ArticleDetail = {
	article: ArticleRow;
	evidence: Array<{
		author: string | null;
		id: string;
		quote: string;
		riskLevel: string;
		sourceLabel: string | null;
		summary: string;
	}>;
	jobs: Array<{
		createdAt: string;
		errorMessage: string | null;
		id: string;
		operation: string;
		status: string;
	}>;
	oaDisplayName: string | null;
	oaId: string | null;
	versions: Array<{
		actorDisplayName: string | null;
		createdAt: string;
		id: string;
		origin: string;
		version: number;
	}>;
};

type ZaloAccount = {
	displayName: string;
	id: string;
	isDefault: boolean;
	lastError: string | null;
	oaId: string;
	status: string;
};

type AiProposal = ArticleContent & { reviewNotes: string[] };

export function ArticleEditor({ articleId }: { articleId: string }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const detail = useQuery({
		queryKey: ["article", articleId],
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
		queryFn: () =>
			fetchJson<{
				accounts: ZaloAccount[];
				configured: boolean;
				enabled: boolean;
			}>("/api/integrations/zalo/accounts"),
	});
	const [draft, setDraft] = useState<ArticleContent | null>(null);
	const [targetOaConnectionId, setTargetOaConnectionId] = useState("");
	const [busy, setBusy] = useState("");
	const [notice, setNotice] = useState("");
	const [schedule, setSchedule] = useState("");
	const [aiInstruction, setAiInstruction] = useState("");
	const [tone, setTone] = useState("Điềm tĩnh, khách quan");
	const [voice, setVoice] = useState("Tự nhiên, gần gũi");
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

	async function refresh() {
		await Promise.all([
			detail.refetch(),
			queryClient.invalidateQueries({ queryKey: ["articles"] }),
		]);
	}

	async function save() {
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
			setNotice("Đã lưu phiên bản mới.");
			await refresh();
			return true;
		});
	}

	async function review(status: string) {
		if (dirty && !(await save())) return;
		await runAction("review", async () => {
			await fetchJson(`/api/articles/${articleId}/review`, {
				body: JSON.stringify({ status }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			setNotice(
				status === "approved"
					? "Bài viết đã được phê duyệt và sẵn sàng đồng bộ bản ẩn."
					: "Đã cập nhật trạng thái duyệt.",
			);
			await refresh();
		});
	}

	async function publishAction(
		action: "sync" | "publish" | "live-update" | "hide",
	) {
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
			setNotice(
				action === "sync"
					? "Đã đồng bộ bản ẩn. Hãy kiểm tra xem trước trước khi xuất bản."
					: "Thao tác Zalo đã hoàn tất.",
			);
			await refresh();
		});
	}

	async function schedulePublish() {
		if (!schedule) {
			setNotice("Hãy chọn ngày giờ xuất bản.");
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
				body: JSON.stringify({
					scheduledAt: new Date(schedule).toISOString(),
				}),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			setNotice("Đã lên lịch xuất bản. Bạn có thể hủy trước thời điểm chạy.");
			await refresh();
		});
	}

	async function cancelSchedule() {
		await runAction("cancel", async () => {
			await fetchJson(`/api/articles/${articleId}/schedule`, {
				method: "DELETE",
			});
			setNotice("Đã hủy lịch xuất bản.");
			await refresh();
		});
	}

	async function refreshFromZalo() {
		await runAction("remote:refresh", async () => {
			await fetchJson(`/api/articles/${articleId}/remote`, { method: "POST" });
			setNotice("Đã làm mới trạng thái và bản xem trước từ Zalo.");
			await refresh();
		});
	}

	async function removeFromZalo() {
		if (
			!window.confirm(
				"Xóa vĩnh viễn bản này khỏi Zalo OA? Bản nội dung trong CyberShield35 vẫn được giữ lại để chỉnh sửa hoặc đồng bộ lại.",
			)
		) {
			return;
		}
		await runAction("remote:remove", async () => {
			await fetchJson(`/api/articles/${articleId}/remote`, {
				method: "DELETE",
			});
			setNotice("Đã xóa bản Zalo. Bản nội dung trong CyberShield35 vẫn được giữ.");
			await refresh();
		});
	}

	async function deleteLocalArticle() {
		if (
			!window.confirm(
				"Xóa vĩnh viễn bài viết này khỏi CyberShield35? Thao tác này không thể hoàn tác.",
			)
		) {
			return;
		}
		await runAction("article:delete", async () => {
			await fetchJson(`/api/articles/${articleId}`, { method: "DELETE" });
			router.push("/articles");
		});
	}

	async function askAi(action: string) {
		if (dirty && !(await save())) return;
		await runAction(`ai:${action}`, async () => {
			const result = await fetchJson<{ proposal: AiProposal }>(
				`/api/articles/${articleId}/ai`,
				{
					body: JSON.stringify({
						action,
						instruction: aiInstruction || undefined,
						tone,
						voice,
					}),
					headers: { "Content-Type": "application/json" },
					method: "POST",
				},
			);
			setProposal(result.proposal);
			setNotice("AI đã tạo đề xuất. So sánh và chọn Áp dụng hoặc Bỏ qua.");
		});
	}

	async function applyProposal() {
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
			setNotice("Đã áp dụng đề xuất AI và lưu một phiên bản có thể khôi phục.");
			await refresh();
		});
	}

	async function restore(versionId: string) {
		if (!window.confirm("Khôi phục phiên bản này thành nội dung hiện tại?")) return;
		await runAction("restore", async () => {
			await fetchJson(
				`/api/articles/${articleId}/versions/${versionId}/restore`,
				{ method: "POST" },
			);
			setNotice("Đã khôi phục phiên bản.");
			await refresh();
		});
	}

	async function runAction(key: string, action: () => Promise<unknown>) {
		setBusy(key);
		setNotice("");
		try {
			await action();
			return true;
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Thao tác không thành công.");
			return false;
		} finally {
			setBusy("");
		}
	}

	if (detail.isPending || !draft) {
		return (
			<div className="grid min-h-[60vh] place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)]">
				<LoaderCircle size={28} className="animate-spin text-[var(--brand)]" />
			</div>
		);
	}
	if (detail.isError || !detail.data) {
		return (
			<div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] p-5 text-sm text-[var(--danger-strong)]">
				{detail.error?.message ?? "Không thể tải bài viết."}
			</div>
		);
	}

	const article = detail.data.article;
	const canSync =
		article.reviewStatus === "approved" &&
		Boolean(targetOaConnectionId && draft.title && draft.description && draft.coverUrl) &&
		draft.blocks.some(
			(block) =>
				(block.type === "text" && block.content.trim()) ||
				(block.type === "image" && block.url),
		);
	const synced = article.syncedContentHash === article.contentHash;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)]">
				<div className="flex min-w-0 items-center gap-3">
					<Link
						href="/articles"
						className="grid size-9 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)]"
						aria-label="Quay lại danh sách bài viết"
					>
						<ArrowLeft size={16} />
					</Link>
					<div className="min-w-0">
						<p className="truncate text-sm font-bold">
							{draft.title || "Bài viết chưa đặt tên"}
						</p>
						<p className="mt-0.5 text-[10px] text-[var(--muted)]">
							{dirty ? "Có thay đổi chưa lưu" : `Đã lưu ${relativeTime(article.updatedAt)}`}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={save}
						disabled={!dirty || Boolean(busy)}
						className={secondaryButton}
					>
						{busy === "save" ? <LoaderCircle className="animate-spin" size={14} /> : <Save size={14} />}
						Lưu
					</button>
					<button
						type="button"
						onClick={() => review(article.reviewStatus === "approved" ? "needs_review" : "approved")}
						disabled={Boolean(busy)}
						className={article.reviewStatus === "approved" ? secondaryButton : primaryButton}
					>
						<Check size={14} />
						{article.reviewStatus === "approved" ? "Yêu cầu duyệt lại" : "Phê duyệt"}
					</button>
				</div>
			</div>

			<Lifecycle article={article} synced={synced} />

			{notice || article.lastError ? (
				<div
					role="status"
					className={`rounded-lg border px-4 py-3 text-[12px] font-semibold ${
						article.lastError
							? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-strong)]"
							: "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]"
					}`}
				>
					{article.lastError ?? notice}
				</div>
			) : null}

			<div className="grid min-w-0 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_330px]">
				<aside className="min-w-0 space-y-4">
					<Section title="Ngữ cảnh & bằng chứng" icon={FileClock}>
						{detail.data.evidence.length ? (
							<div className="space-y-2">
								{detail.data.evidence.map((item) => (
									<Link
										key={item.id}
										href={`/evidence/${item.id}`}
										className="block rounded-md border border-[var(--border)] bg-[var(--surface-soft)] p-3 hover:border-[var(--brand)]"
									>
										<div className="flex items-center justify-between gap-2">
											<p className="truncate text-[10px] font-bold">
												{item.sourceLabel ?? item.author ?? "Bằng chứng"}
											</p>
											<span className="text-[9px] font-bold uppercase text-[var(--muted)]">
												{item.riskLevel}
											</span>
										</div>
										<p className="mt-1.5 line-clamp-3 text-[11px] leading-4 text-[var(--muted)]">
											{item.summary}
										</p>
									</Link>
								))}
							</div>
						) : (
							<p className="text-[11px] leading-5 text-[var(--muted)]">
								Chưa ghim bằng chứng. Mở Chat để tạo bài từ scan hoặc thêm evidence
								qua API bài viết.
							</p>
						)}
					</Section>
					<Section title="Lịch sử phiên bản" icon={Clock3}>
						<div className="space-y-2">
							{detail.data.versions.slice(0, 8).map((version) => (
								<div
									key={version.id}
									className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] p-2.5"
								>
									<div>
										<p className="text-[10px] font-bold">
											v{version.version} · {version.origin === "ai" ? "AI" : "Thủ công"}
										</p>
										<p className="mt-0.5 text-[9px] text-[var(--muted)]">
											{relativeTime(version.createdAt)}
										</p>
									</div>
									<button
										type="button"
										onClick={() => restore(version.id)}
										disabled={Boolean(busy)}
										className="grid size-8 place-items-center rounded-md border border-[var(--border)]"
										aria-label={`Khôi phục phiên bản ${version.version}`}
									>
										<Undo2 size={13} />
									</button>
								</div>
							))}
						</div>
					</Section>
				</aside>

				<main className="min-w-0 space-y-4">
					<Section title="Thông tin bài viết" icon={Type}>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field
								label="Tiêu đề"
								count={`${draft.title.length}/150`}
								className="sm:col-span-2"
							>
								<input
									value={draft.title}
									maxLength={150}
									onChange={(event) =>
										setDraft({ ...draft, title: event.target.value })
									}
									className={inputClass}
									placeholder="Tiêu đề ngắn gọn, rõ ý"
								/>
							</Field>
							<Field label="Tác giả" count={`${draft.author.length}/50`}>
								<input
									value={draft.author}
									maxLength={50}
									onChange={(event) =>
										setDraft({ ...draft, author: event.target.value })
									}
									className={inputClass}
									placeholder="Tên đơn vị hoặc tác giả"
								/>
							</Field>
							<Field label="Zalo OA đích">
								<select
									value={targetOaConnectionId}
									onChange={(event) => setTargetOaConnectionId(event.target.value)}
									className={inputClass}
								>
									<option value="">Chọn Zalo OA</option>
									{accounts.data?.accounts.map((account) => (
										<option key={account.id} value={account.id}>
											{account.displayName}
											{account.isDefault ? " · Mặc định" : ""}
										</option>
									))}
								</select>
							</Field>
							<Field
								label="Mô tả"
								count={`${draft.description.length}/300`}
								className="sm:col-span-2"
							>
								<textarea
									value={draft.description}
									maxLength={300}
									rows={3}
									onChange={(event) =>
										setDraft({ ...draft, description: event.target.value })
									}
									className={textareaClass}
									placeholder="Tóm tắt tự nhiên để người đọc hiểu nội dung chính"
								/>
							</Field>
							<Field label="URL ảnh bìa" className="sm:col-span-2">
								<input
									value={draft.coverUrl ?? ""}
									onChange={(event) =>
										setDraft({
											...draft,
											coverUrl: event.target.value || null,
										})
									}
									className={inputClass}
									placeholder="https://… (ảnh bìa Zalo tối đa 1 MB)"
								/>
							</Field>
						</div>
					</Section>

					<Section
						title="Nội dung"
						icon={Type}
						action={
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() =>
										setDraft({
											...draft,
											blocks: [
												...draft.blocks,
												{ content: "", id: crypto.randomUUID(), type: "text" },
											],
										})
									}
									className={smallButton}
								>
									<Plus size={12} /> Văn bản
								</button>
								<button
									type="button"
									onClick={() =>
										setDraft({
											...draft,
											blocks: [
												...draft.blocks,
												{ id: crypto.randomUUID(), type: "image", url: "" },
											],
										})
									}
									className={smallButton}
								>
									<ImagePlus size={12} /> Ảnh
								</button>
							</div>
						}
					>
						<div className="space-y-3">
							{draft.blocks.map((block, index) => (
								<BlockEditor
									key={block.id}
									block={block}
									index={index}
									count={draft.blocks.length}
									onChange={(next) =>
										setDraft({
											...draft,
											blocks: draft.blocks.map((item) =>
												item.id === block.id ? next : item,
											),
										})
									}
									onMove={(direction) =>
										setDraft({
											...draft,
											blocks: moveBlock(draft.blocks, index, direction),
										})
									}
									onRemove={() =>
										setDraft({
											...draft,
											blocks: draft.blocks.filter((item) => item.id !== block.id),
										})
									}
								/>
							))}
						</div>
					</Section>

					<Section title="Biên tập bằng AI" icon={Bot}>
						<div className="grid gap-3 sm:grid-cols-2">
							<Field label="Giọng điệu">
								<input value={tone} onChange={(event) => setTone(event.target.value)} className={inputClass} />
							</Field>
							<Field label="Văn phong">
								<input value={voice} onChange={(event) => setVoice(event.target.value)} className={inputClass} />
							</Field>
							<Field label="Yêu cầu biên tập" className="sm:col-span-2">
								<textarea
									value={aiInstruction}
									onChange={(event) => setAiInstruction(event.target.value)}
									rows={3}
									className={textareaClass}
									placeholder="Ví dụ: Mở đầu gần gũi hơn, giữ nguyên mọi số liệu…"
								/>
							</Field>
						</div>
						<div className="mt-3 flex flex-wrap gap-2">
							{[
								["draft", "Viết bản đầu"],
								["outline", "Tạo dàn ý"],
								["rewrite", "Viết lại"],
								["shorten", "Rút gọn"],
								["expand", "Mở rộng"],
								["title_description", "Tiêu đề & mô tả"],
								["claim_check", "Kiểm tra luận điểm"],
							].map(([action, label]) => (
								<button
									key={action}
									type="button"
									disabled={Boolean(busy)}
									onClick={() => askAi(action!)}
									className={smallButton}
								>
									{busy === `ai:${action}` ? (
										<LoaderCircle size={12} className="animate-spin" />
									) : (
										<Sparkles size={12} />
									)}
									{label}
								</button>
							))}
						</div>
						{proposal ? (
							<AiProposalReview
								current={draft}
								proposal={proposal}
								onApply={applyProposal}
								onReject={() => setProposal(null)}
								pending={busy === "ai:apply"}
							/>
						) : null}
					</Section>
				</main>

				<aside className="min-w-0 space-y-4">
					<Section title="Xem trước Zalo" icon={Eye}>
						<ZaloPreview content={draft} />
					</Section>
					<Section title="Đồng bộ & xuất bản" icon={Radio}>
						{!accounts.data?.enabled ? (
							<div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-[11px] leading-5 text-[var(--warning-strong)]">
								Tích hợp đang tắt. Quản trị viên cần cấu hình biến môi trường và bật
								<code className="mx-1">ZALO_OA_ENABLED</code>.
							</div>
						) : accounts.data.accounts.length === 0 ? (
							<a
								href="/api/integrations/zalo/authorize"
								className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#0068ff] text-[12px] font-bold text-white"
							>
								<ExternalLink size={14} /> Kết nối Zalo OA
							</a>
						) : (
							<div className="space-y-3">
								<button
									type="button"
									disabled={!canSync || Boolean(busy)}
									onClick={() => publishAction("sync")}
									className={`${primaryButton} w-full`}
								>
									{busy === "sync" ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
									Đồng bộ bản ẩn
								</button>
								{article.publicationStatus === "published" && !synced ? (
									<button
										type="button"
										disabled={Boolean(busy)}
										onClick={() => publishAction("live-update")}
										className={`${primaryButton} w-full`}
									>
										<Send size={14} /> Cập nhật bài đang hiển thị
									</button>
								) : (
									<button
										type="button"
										disabled={
											!synced ||
											!["hidden", "scheduled"].includes(article.publicationStatus) ||
											Boolean(busy)
										}
										onClick={() => publishAction("publish")}
										className={`${primaryButton} w-full`}
									>
										<Send size={14} /> Xuất bản ngay
									</button>
								)}
								<div className="border-t border-[var(--border)] pt-3">
									<label className="text-[10px] font-bold uppercase text-[var(--muted)]">
										Lên lịch · Giờ trình duyệt
									</label>
									<input
										type="datetime-local"
										value={schedule}
										onChange={(event) => setSchedule(event.target.value)}
										className={`${inputClass} mt-2`}
									/>
									<button
										type="button"
										disabled={!synced || article.publicationStatus !== "hidden" || Boolean(busy)}
										onClick={schedulePublish}
										className={`${secondaryButton} mt-2 w-full`}
									>
										<CalendarClock size={14} /> Xác nhận lịch xuất bản
									</button>
									{article.publicationStatus === "scheduled" ? (
										<button
											type="button"
											onClick={cancelSchedule}
											disabled={Boolean(busy)}
											className="mt-2 w-full text-[11px] font-bold text-[var(--danger-strong)]"
										>
											Hủy lịch hiện tại
										</button>
									) : null}
									{article.publicationStatus === "published" ? (
										<button
											type="button"
											onClick={() => publishAction("hide")}
											disabled={Boolean(busy)}
											className="mt-3 w-full text-[11px] font-bold text-[var(--danger-strong)]"
										>
											Ẩn bài khỏi Zalo
										</button>
									) : null}
									{article.remoteArticleId ? (
										<div className="mt-3 grid grid-cols-2 gap-2">
											<button
												type="button"
												onClick={refreshFromZalo}
												disabled={Boolean(busy)}
												className={secondaryButton}
											>
												<RefreshCw size={13} />
												Làm mới
											</button>
											<button
												type="button"
												onClick={removeFromZalo}
												disabled={Boolean(busy)}
												className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--danger-border)] px-2 text-[10px] font-bold text-[var(--danger-strong)]"
											>
												<Trash2 size={13} />
												Xóa bản Zalo
											</button>
										</div>
									) : (
										<button
											type="button"
											onClick={deleteLocalArticle}
											disabled={Boolean(busy)}
											className="mt-3 w-full text-[10px] font-bold text-[var(--danger-strong)]"
										>
											Xóa bài khỏi CyberShield35
										</button>
									)}
								</div>
							</div>
						)}
						<p className="mt-3 text-[10px] leading-4 text-[var(--muted)]">
							Không thao tác nào từ Chat có thể xuất bản. “Xuất bản ngay” và lịch
							đăng luôn cần xác nhận tại đây.
						</p>
					</Section>
					<Section title="Hoạt động gần đây" icon={Clock3}>
						<div className="space-y-2">
							{detail.data.jobs.slice(0, 6).map((job) => (
								<div key={job.id} className="rounded-md border border-[var(--border)] p-2.5">
									<div className="flex items-center justify-between gap-2">
										<p className="text-[10px] font-bold">{operationLabel(job.operation)}</p>
										<span className="text-[9px] font-bold text-[var(--muted)]">{job.status}</span>
									</div>
									{job.errorMessage ? (
										<p className="mt-1 text-[9px] leading-4 text-[var(--danger-strong)]">{job.errorMessage}</p>
									) : null}
								</div>
							))}
						</div>
					</Section>
					<Section title="Xuất & tải xuống" icon={ExternalLink}>
						<ExportActions
							compact
							content={articlePlainText(draft)}
							fileName={draft.title || "bai-viet-cybershield35"}
							title={draft.title || "Bài viết CyberShield35"}
						/>
					</Section>
				</aside>
			</div>
		</div>
	);
}

function Lifecycle({ article, synced }: { article: ArticleRow; synced: boolean }) {
	const steps = [
		{ done: true, label: "Bản nháp" },
		{ done: article.reviewStatus === "approved", label: "Đã duyệt" },
		{ done: Boolean(article.remoteArticleId && synced), label: "Bản ẩn Zalo" },
		{
			done: ["scheduled", "published"].includes(article.publicationStatus),
			label: article.publicationStatus === "scheduled" ? "Đã lên lịch" : "Đã xuất bản",
		},
	];
	return (
		<ol className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 sm:grid-cols-4">
			{steps.map((step, index) => (
				<li key={step.label} className="flex items-center gap-2">
					<span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${step.done ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-soft)] text-[var(--muted)]"}`}>
						{step.done ? <Check size={12} /> : index + 1}
					</span>
					<span className="text-[10px] font-bold">{step.label}</span>
					{index < steps.length - 1 ? <ChevronRight size={12} className="ml-auto hidden text-[var(--muted)] sm:block" /> : null}
				</li>
			))}
		</ol>
	);
}

function Section({
	action,
	children,
	icon: Icon,
	title,
}: {
	action?: React.ReactNode;
	children: React.ReactNode;
	icon: typeof Eye;
	title: string;
}) {
	return (
		<section className="min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
			<header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
				<div className="flex min-w-0 items-center gap-2">
					<Icon size={15} className="shrink-0 text-[var(--brand)]" />
					<h2 className="truncate text-[12px] font-bold">{title}</h2>
				</div>
				{action}
			</header>
			<div className="p-4">{children}</div>
		</section>
	);
}

function Field({
	children,
	className = "",
	count,
	label,
}: {
	children: React.ReactNode;
	className?: string;
	count?: string;
	label: string;
}) {
	return (
		<label className={`block min-w-0 ${className}`}>
			<span className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wide text-[var(--muted-strong)]">
				{label}
				{count ? <span className="font-semibold text-[var(--muted)]">{count}</span> : null}
			</span>
			<span className="mt-2 block">{children}</span>
		</label>
	);
}

function BlockEditor({
	block,
	count,
	index,
	onChange,
	onMove,
	onRemove,
}: {
	block: ArticleBlock;
	count: number;
	index: number;
	onChange: (block: ArticleBlock) => void;
	onMove: (direction: -1 | 1) => void;
	onRemove: () => void;
}) {
	return (
		<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
			<div className="mb-2 flex items-center justify-between gap-3">
				<p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-[var(--muted)]">
					{block.type === "text" ? <Type size={12} /> : <ImagePlus size={12} />}
					Khối {index + 1} · {block.type === "text" ? "Văn bản" : "Ảnh"}
				</p>
				<div className="flex gap-1">
					<button type="button" disabled={index === 0} onClick={() => onMove(-1)} className={iconButton} aria-label="Di chuyển lên">
						<ArrowUp size={12} />
					</button>
					<button type="button" disabled={index === count - 1} onClick={() => onMove(1)} className={iconButton} aria-label="Di chuyển xuống">
						<ArrowDown size={12} />
					</button>
					<button type="button" onClick={onRemove} className={`${iconButton} text-[var(--danger-strong)]`} aria-label="Xóa khối">
						<Trash2 size={12} />
					</button>
				</div>
			</div>
			{block.type === "text" ? (
				<textarea
					value={block.content}
					onChange={(event) => onChange({ ...block, content: event.target.value })}
					rows={Math.min(16, Math.max(5, block.content.split("\n").length + 2))}
					className={textareaClass}
					placeholder="Viết nội dung tự nhiên, rõ ràng và có căn cứ…"
				/>
			) : (
				<div className="space-y-2">
					<input
						value={block.url}
						onChange={(event) => onChange({ ...block, url: event.target.value })}
						className={inputClass}
						placeholder="https://…"
					/>
					<input
						value={block.caption ?? ""}
						onChange={(event) =>
							onChange({ ...block, caption: event.target.value || undefined })
						}
						className={inputClass}
						placeholder="Chú thích ảnh (không bắt buộc)"
					/>
					{isImageUrl(block.url) ? (
						<Image unoptimized width={960} height={540} src={block.url} alt={block.caption ?? ""} className="max-h-56 w-full rounded-md object-cover" />
					) : null}
				</div>
			)}
		</div>
	);
}

function ZaloPreview({ content }: { content: ArticleContent }) {
	return (
		<article className="overflow-hidden rounded-lg border border-[#dbe7f7] bg-white text-slate-900 shadow-sm">
			{isImageUrl(content.coverUrl) ? (
				<Image unoptimized width={960} height={540} src={content.coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />
			) : (
				<div className="grid aspect-[16/9] place-items-center bg-slate-100 text-xs font-bold text-slate-400">
					Chưa có ảnh bìa
				</div>
			)}
			<div className="p-4">
				<p className="text-[10px] font-bold uppercase tracking-wide text-[#0068ff]">Zalo Article</p>
				<h3 className="mt-2 text-base font-bold leading-6">{content.title || "Tiêu đề bài viết"}</h3>
				<p className="mt-2 text-[11px] leading-5 text-slate-600">{content.description || "Mô tả bài viết sẽ hiển thị tại đây."}</p>
				<div className="mt-4 space-y-3">
					{content.blocks.map((block) =>
						block.type === "text" ? (
							<p key={block.id} className="whitespace-pre-wrap text-[12px] leading-5 text-slate-700">{block.content}</p>
						) : isImageUrl(block.url) ? (
							<figure key={block.id}>
								<Image unoptimized width={960} height={540} src={block.url} alt={block.caption ?? ""} className="h-auto w-full rounded-md" />
								{block.caption ? <figcaption className="mt-1 text-[10px] text-slate-500">{block.caption}</figcaption> : null}
							</figure>
						) : null,
					)}
				</div>
			</div>
		</article>
	);
}

function AiProposalReview({
	current,
	onApply,
	onReject,
	pending,
	proposal,
}: {
	current: ArticleContent;
	onApply: () => void;
	onReject: () => void;
	pending: boolean;
	proposal: AiProposal;
}) {
	return (
		<div className="mt-4 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] p-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-[12px] font-bold text-[var(--accent-strong)]">Đề xuất AI đang chờ duyệt</p>
					<p className="mt-1 text-[10px] text-[var(--muted)]">Không thay đổi nội dung cho đến khi bạn chọn Áp dụng.</p>
				</div>
				<Sparkles size={18} className="text-[var(--accent-strong)]" />
			</div>
			<div className="mt-3 grid gap-3 lg:grid-cols-2">
				<div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
					<p className="text-[9px] font-bold uppercase text-[var(--muted)]">Hiện tại</p>
					<p className="mt-2 text-[11px] font-bold">{current.title || "Chưa có tiêu đề"}</p>
					<p className="mt-1 line-clamp-5 whitespace-pre-wrap text-[10px] leading-4 text-[var(--muted)]">{current.blocks.filter((block) => block.type === "text").map((block) => block.content).join("\n\n")}</p>
				</div>
				<div className="rounded-md border border-[var(--accent)] bg-[var(--surface)] p-3">
					<p className="text-[9px] font-bold uppercase text-[var(--accent-strong)]">Đề xuất</p>
					<p className="mt-2 text-[11px] font-bold">{proposal.title}</p>
					<p className="mt-1 line-clamp-5 whitespace-pre-wrap text-[10px] leading-4 text-[var(--muted)]">{proposal.blocks.filter((block) => block.type === "text").map((block) => block.content).join("\n\n")}</p>
				</div>
			</div>
			{proposal.reviewNotes.length ? (
				<ul className="mt-3 space-y-1 text-[10px] leading-4 text-[var(--muted-strong)]">
					{proposal.reviewNotes.map((note) => <li key={note}>• {note}</li>)}
				</ul>
			) : null}
			<div className="mt-3 flex gap-2">
				<button type="button" onClick={onApply} disabled={pending} className={primaryButton}>
					{pending ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />} Áp dụng
				</button>
				<button type="button" onClick={onReject} disabled={pending} className={secondaryButton}>Bỏ qua</button>
			</div>
		</div>
	);
}

function moveBlock(blocks: ArticleBlock[], index: number, direction: -1 | 1) {
	const target = index + direction;
	if (target < 0 || target >= blocks.length) return blocks;
	const next = [...blocks];
	const [block] = next.splice(index, 1);
	if (block) next.splice(target, 0, block);
	return next;
}

async function fetchJson<T = unknown>(
	url: string,
	init?: RequestInit,
): Promise<T> {
	const response = await fetch(url, { cache: "no-store", ...init });
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		const message =
			body && typeof body === "object" && "error" in body
				? typeof body.error === "string"
					? body.error
					: JSON.stringify(body.error)
				: "Thao tác không thành công.";
		throw new Error(message);
	}
	return body as T;
}

function relativeTime(value: string) {
	const seconds = Math.max(1, Math.round((Date.now() - Date.parse(value)) / 1000));
	if (seconds < 60) return "vừa xong";
	if (seconds < 3_600) return `${Math.floor(seconds / 60)} phút trước`;
	if (seconds < 86_400) return `${Math.floor(seconds / 3_600)} giờ trước`;
	return `${Math.floor(seconds / 86_400)} ngày trước`;
}

function operationLabel(operation: string) {
	return (
		{
			hide: "Ẩn bài",
			publish: "Xuất bản",
			sync_hidden: "Đồng bộ bản ẩn",
			update_visible: "Cập nhật bài đã đăng",
		}[operation] ?? operation
	);
}

function articlePlainText(content: ArticleContent) {
	return [
		content.description,
		...content.blocks.map((block) =>
			block.type === "text"
				? block.content
				: block.caption
					? `[Ảnh] ${block.caption}`
					: "[Ảnh]",
		),
	]
		.filter(Boolean)
		.join("\n\n");
}

function isImageUrl(value: string | null | undefined): value is string {
	if (!value) return false;
	try {
		return ["http:", "https:"].includes(new URL(value).protocol);
	} catch {
		return false;
	}
}

const inputClass =
	"h-10 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10";
const textareaClass =
	"w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[12px] leading-5 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10";
const primaryButton =
	"inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--brand)] px-3 text-[11px] font-bold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
	"inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[11px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50";
const smallButton =
	"inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[10px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--brand)] disabled:opacity-50";
const iconButton =
	"grid size-7 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] disabled:opacity-35";
