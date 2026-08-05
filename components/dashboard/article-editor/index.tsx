"use client";

import { FileClock, Sparkles, Type } from "lucide-react";
import { useState } from "react";

import { isRenderableImageUrl } from "@/components/dashboard/safe-image";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AiPanel, AiProposalReview } from "./ai-panel";
import { ComposePanel } from "./compose-panel";
import { ArticleContextPanel } from "./context-panel";
import { EditorHeader, EditorNoticeBar, editorStage } from "./editor-header";
import { PublishRail } from "./publish-rail";
import { ArticleEditorSkeleton } from "./skeleton";
import type { ReadinessItem } from "./types";
import { useArticleEditor } from "./use-article-editor";

export function ArticleEditor({ articleId }: { articleId: string }) {
	const editor = useArticleEditor(articleId);
	const [railOpen, setRailOpen] = useState(true);
	const { detail, draft } = editor;

	if (detail.isPending || !draft) return <ArticleEditorSkeleton />;
	if (detail.isError || !detail.data) {
		return (
			<div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-5 text-sm font-semibold text-[var(--danger-strong)]">
				{detail.error?.message ?? "Không thể tải bài viết."}
			</div>
		);
	}

	const article = detail.data.article;
	const hasBody = draft.blocks.some((block) =>
		block.type === "text" ? Boolean(block.content.trim()) : Boolean(block.url),
	);
	const readiness: ReadinessItem[] = [
		{
			done: Boolean(draft.title.trim()),
			hint: "Đặt tiêu đề cho bài viết.",
			label: "Có tiêu đề",
		},
		{
			done: Boolean(draft.description.trim()),
			hint: "Viết một đến hai câu trích yếu.",
			label: "Có trích yếu",
		},
		{
			done: isRenderableImageUrl(draft.coverUrl),
			hint: "Tải ảnh bìa lên.",
			label: "Có ảnh bìa",
		},
		{ done: hasBody, hint: "Thêm ít nhất một khối nội dung.", label: "Có nội dung" },
		{
			done: Boolean(editor.targetOaConnectionId),
			hint: "Chọn tài khoản Zalo OA đích.",
			label: "Đã chọn Zalo OA",
		},
		{
			done: article.reviewStatus === "approved",
			hint: "Bấm Phê duyệt sau khi rà soát nội dung.",
			label: "Đã được phê duyệt",
		},
	];
	const synced = article.syncedContentHash === article.contentHash;
	const blockers = [
		article.reviewStatus === "approved" ? null : "Bài viết cần được phê duyệt.",
		draft.title.trim() ? null : "Bài viết cần có tiêu đề.",
		hasBody ? null : "Bài viết cần có ít nhất một khối nội dung.",
		readiness.some((item) => !item.done)
			? "Chưa đủ điều kiện đăng lên Zalo OA — xem danh sách kiểm tra ở cột phải."
			: null,
	].filter((value): value is string => Boolean(value));

	return (
		<div className="space-y-4">
			<EditorHeader
				article={article}
				blockers={blockers}
				busy={editor.busy}
				dirty={editor.dirty}
				onPublish={() => void editor.publish()}
				onReview={(status) => void editor.review(status)}
				onSave={() => void editor.save()}
				onToggleRail={() => setRailOpen((value) => !value)}
				publishStep={editor.publishStep}
				publishTarget={editor.publishTarget}
				railOpen={railOpen}
				stage={editorStage(article, synced)}
				title={draft.title}
				versionCount={detail.data.versions.length}
			/>

			<EditorNoticeBar
				lastError={article.lastError}
				notice={editor.notice}
				onDismiss={() => editor.setNotice(null)}
			/>

			<div
				className={`grid min-w-0 items-start gap-4 ${
					railOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(340px,380px)]" : ""
				}`}
			>
				<main className="min-w-0">
					<Tabs defaultValue="compose" className="gap-4">
						<TabsList aria-label="Không gian biên tập bài viết" className="w-full">
							<TabsTrigger value="compose" className="flex-1">
								<Type size={14} /> Soạn bài
							</TabsTrigger>
							<TabsTrigger value="ai" className="flex-1">
								<Sparkles size={14} /> AI hỗ trợ
							</TabsTrigger>
							<TabsTrigger value="context" className="flex-1">
								<FileClock size={14} /> Bằng chứng & lịch sử
								{detail.data.evidence.length ? (
									<Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
										{detail.data.evidence.length}
									</Badge>
								) : null}
							</TabsTrigger>
						</TabsList>

						<TabsContent value="compose">
							<ComposePanel
								articleId={articleId}
								draft={draft}
								onChange={editor.setDraft}
								onCoverUnavailable={editor.dropCover}
								onImageBlockUnavailable={editor.dropImageBlock}
							/>
						</TabsContent>

						<TabsContent value="ai">
							<AiPanel
								busy={editor.busy}
								draft={draft}
								editorialIntent={editor.editorialIntent}
								evidenceCount={detail.data.evidence.length}
								instruction={editor.aiInstruction}
								model={editor.model}
								models={editor.models.data}
								onAsk={(action) => void editor.askAi(action)}
								onEditorialIntentChange={editor.setEditorialIntent}
								onInstructionChange={editor.setAiInstruction}
								onModelChange={editor.setModel}
								onToneChange={editor.setTone}
								onVoiceChange={editor.setVoice}
								tone={editor.tone}
								voice={editor.voice}
							/>
						</TabsContent>

						<TabsContent value="context">
							<ArticleContextPanel
								busy={Boolean(editor.busy)}
								evidence={detail.data.evidence}
								onRestore={(versionId) => void editor.restore(versionId)}
								versions={detail.data.versions}
							/>
						</TabsContent>
					</Tabs>
				</main>

				{railOpen ? (
					<PublishRail
						accounts={editor.accounts.data}
						busy={editor.busy}
						detail={detail.data}
						draft={draft}
						onCancelSchedule={() => void editor.cancelSchedule()}
						onCoverUnavailable={editor.dropCover}
						onDelete={() => void editor.deleteLocalArticle()}
						onPublishAction={(action) => void editor.publishAction(action)}
						onPublishTargetChange={editor.setPublishTarget}
						onSyncPreview={() => void editor.syncPreview()}
						onRefreshRemote={() => void editor.refreshFromZalo()}
						onRemoveRemote={() => void editor.removeFromZalo()}
						onScheduleChange={editor.setSchedule}
						onSchedulePublish={() => void editor.schedulePublish()}
						onTargetOaChange={editor.setTargetOaConnectionId}
						publishTarget={editor.publishTarget}
						readiness={readiness}
						schedule={editor.schedule}
						synced={synced}
						targetOaConnectionId={editor.targetOaConnectionId}
					/>
				) : null}
			</div>

			<Dialog
				open={Boolean(editor.proposal)}
				onOpenChange={(open) => {
					if (!open && editor.busy !== "ai:apply") editor.setProposal(null);
				}}
			>
				<DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] sm:max-w-4xl">
					<DialogHeader>
						<DialogTitle>So sánh đề xuất biên tập</DialogTitle>
						<DialogDescription>
							AI không thay đổi bài viết cho đến khi bạn xem lại và chọn Áp dụng.
						</DialogDescription>
					</DialogHeader>
					{editor.proposal ? (
						<AiProposalReview
							current={draft}
							proposal={editor.proposal}
							onApply={() => void editor.applyProposal()}
							onReject={() => editor.setProposal(null)}
							pending={editor.busy === "ai:apply"}
						/>
					) : null}
				</DialogContent>
			</Dialog>
		</div>
	);
}
