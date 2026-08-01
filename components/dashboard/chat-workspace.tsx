"use client";

import { useChat } from "@ai-sdk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tuturuuu/ui/dropdown-menu";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type FileUIPart,
} from "ai";
import {
  Archive,
  Brain,
  ChevronDown,
  Copy,
  FileText,
  GitFork,
  History,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  WandSparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import type {
  ChatMode,
  ChatThinkingMode,
  ChatUIMessage,
} from "@/lib/chat/types";

type ConversationRow = {
  archivedAt: string | null;
  contextBudget: number;
  createdAt: string;
  id: string;
  lastMessageAt: string | null;
  model: string | null;
  ownerDisplayName: string | null;
  ownerUserId: string;
  pinnedContext: Array<{
    href?: string;
    id: string;
    label: string;
    type: "scan" | "evidence" | "topic" | "draft" | "article";
  }>;
  temperature: number;
  title: string;
  updatedAt: string;
  visibility: "private" | "workspace";
};

type AttachmentRow = {
  contentType: string;
  errorMessage: string | null;
  fileName: string;
  id: string;
  processedAt: string | null;
  sizeBytes: number;
  status:
    | "pending_upload"
    | "uploading"
    | "processing"
    | "ready"
    | "failed"
    | "deleting"
    | "deleted";
};

type ChatDetail = {
  attachments: AttachmentRow[];
  conversation: ConversationRow;
  messages: ChatUIMessage[];
  modelRuns: Array<{
    id: string;
    inputTokens: number | null;
    latencyMs: number | null;
    model: string;
    outputTokens: number | null;
    provider: string;
    startedAt: string;
    status: "running" | "completed" | "failed" | "aborted";
    stepCount: number;
  }>;
  readOnly: boolean;
};

const accept = [
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  "image/png",
  "image/jpeg",
  "image/webp",
].join(",");

function usePortalTarget(id: string) {
  return useSyncExternalStore(
    () => () => undefined,
    () => document.getElementById(id),
    () => null,
  );
}

function openChatNavigation() {
  window.dispatchEvent(new Event("cybershield35:open-chat-navigation"));
}

function closeChatNavigation() {
  window.dispatchEvent(new Event("cybershield35:close-navigation"));
}

export function ChatWorkspace({
  conversationId,
  initialPrompt,
}: {
  conversationId?: string;
  initialPrompt?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const promptStarted = useRef(false);
  const sidebarPortal = usePortalTarget("chat-sidebar-portal");
  const topbarPortal = usePortalTarget("chat-topbar-portal");
  const [historyQuery, setHistoryQuery] = useState("");
  const conversations = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () =>
      fetchJson<{ conversations: ConversationRow[] }>(
        "/api/chat/conversations",
      ),
    staleTime: 10_000,
  });
  const createConversation = useMutation({
    mutationFn: (prompt?: string) =>
      fetchJson<{ conversation: ConversationRow }>("/api/chat/conversations", {
        body: JSON.stringify({
          title: prompt ? prompt.slice(0, 80) : undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    onSuccess: ({ conversation }, prompt) => {
      void queryClient.invalidateQueries({
        queryKey: ["chat", "conversations"],
      });
      router.push(
        prompt
          ? `/chat/${conversation.id}?prompt=${encodeURIComponent(prompt)}`
          : `/chat/${conversation.id}`,
      );
    },
  });
  useEffect(() => {
    if (conversationId || !initialPrompt?.trim() || promptStarted.current)
      return;
    promptStarted.current = true;
    createConversation.mutate(initialPrompt.trim());
  }, [conversationId, createConversation, initialPrompt]);
  const visibleConversations = useMemo(() => {
    const normalized = historyQuery.trim().toLocaleLowerCase("vi");
    return (conversations.data?.conversations ?? []).filter((conversation) =>
      normalized
        ? conversation.title.toLocaleLowerCase("vi").includes(normalized)
        : true,
    );
  }, [conversations.data?.conversations, historyQuery]);

  const createChat = () => createConversation.mutate(undefined);
  return (
    <>
      {sidebarPortal
        ? createPortal(
            <ChatHistoryMenu
              conversationId={conversationId}
              conversations={visibleConversations}
              creating={createConversation.isPending}
              historyQuery={historyQuery}
              loading={conversations.isPending}
              onCreate={createChat}
              onRetry={() => void conversations.refetch()}
              onSearch={setHistoryQuery}
              onSelect={(id) => {
                router.push(`/chat/${id}`);
                closeChatNavigation();
              }}
              total={conversations.data?.conversations.length ?? 0}
              failed={conversations.isError}
            />,
            sidebarPortal,
          )
        : null}
      {topbarPortal && !conversationId
        ? createPortal(
            <ChatLandingTopBar
              creating={createConversation.isPending}
              loading={conversations.isPending}
              onCreate={createChat}
              total={conversations.data?.conversations.length ?? 0}
            />,
            topbarPortal,
          )
        : null}
      <div className="h-full min-h-0 overflow-hidden bg-[var(--background)]">
        {conversationId ? (
          <ConversationWorkspace
            key={conversationId}
            conversationId={conversationId}
            initialPrompt={initialPrompt}
          />
        ) : (
          <div className="grid h-full min-h-0 place-items-center overflow-y-auto p-6">
            <div className="max-w-lg text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <MessageCircle size={25} />
              </span>
              <h2 className="mt-4 text-lg font-extrabold text-[var(--foreground)]">
                Chat phân tích nội bộ
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Tra cứu bằng chứng, lần quét và chủ đề; phân tích tệp qua
                Tuturuuu Drive; chuẩn bị nội dung để đội ngũ xem xét.
              </p>
              <button
                type="button"
                onClick={createChat}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-xs font-extrabold text-white"
              >
                <Plus size={15} /> Tạo cuộc trò chuyện riêng tư
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ChatHistoryMenu({
  conversationId,
  conversations,
  creating,
  failed,
  historyQuery,
  loading,
  onCreate,
  onRetry,
  onSearch,
  onSelect,
  total,
}: {
  conversationId?: string;
  conversations: ConversationRow[];
  creating: boolean;
  failed: boolean;
  historyQuery: string;
  loading: boolean;
  onCreate: () => void;
  onRetry: () => void;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  total: number;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col px-3 pb-3">
      <div className="flex items-center justify-between py-3">
        <div className="flex min-w-0 items-center gap-2">
          <History className="shrink-0" size={14} />
          <div className="min-w-0">
            <p className="truncate text-xs font-extrabold">Trò chuyện</p>
            {loading ? (
              <span
                aria-label="Đang tải danh sách trò chuyện"
                className="mt-1 block h-2.5 w-20 animate-pulse rounded-full bg-[var(--surface-elevated)]"
              />
            ) : (
              <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                {total} cuộc trò chuyện
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className={iconButtonClass}
          aria-label="Tạo cuộc trò chuyện mới"
          title="Tạo cuộc trò chuyện mới"
        >
          {creating ? (
            <LoaderCircle className="animate-spin" size={15} />
          ) : (
            <Plus size={15} />
          )}
        </button>
      </div>
      <label className="relative block shrink-0">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          size={13}
        />
        <input
          value={historyQuery}
          onChange={(event) => onSearch(event.target.value)}
          className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-8 pr-2 text-[11px] outline-none focus:border-[var(--accent)]"
          placeholder="Tìm cuộc trò chuyện…"
          aria-label="Tìm cuộc trò chuyện"
          disabled={loading}
        />
      </label>
      <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
        {loading ? <ChatHistorySkeleton /> : null}
        {!loading && !failed
          ? conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${conversation.id === conversationId ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-soft)]"}`}
              >
                <p className="truncate text-xs font-bold">
                  {conversation.title}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
                  <span>
                    {conversation.visibility === "workspace"
                      ? "Đã chia sẻ"
                      : "Riêng tư"}
                  </span>
                  <span>{relativeTime(conversation.updatedAt)}</span>
                </div>
              </button>
            ))
          : null}
        {!loading && failed ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-4 text-center">
            <p className="text-[10px] font-semibold text-[var(--muted-strong)]">
              Chưa tải được lịch sử trò chuyện.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 text-[10px] font-bold text-[var(--brand-strong)] hover:underline"
            >
              Thử lại
            </button>
          </div>
        ) : null}
        {!loading && !failed && conversations.length === 0 ? (
          <p className="px-3 py-8 text-center text-[10px] text-[var(--muted)]">
            Không tìm thấy cuộc trò chuyện.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ChatHistorySkeleton() {
  return (
    <div
      aria-label="Đang tải danh sách trò chuyện"
      className="space-y-1"
      role="status"
    >
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-lg border border-transparent px-3 py-3"
        >
          <div className="h-3 w-3/4 rounded-full bg-[var(--surface-elevated)]" />
          <div className="mt-2 flex items-center justify-between gap-4">
            <div className="h-2.5 w-14 rounded-full bg-[var(--surface-elevated)]" />
            <div className="h-2.5 w-10 rounded-full bg-[var(--surface-elevated)]" />
          </div>
        </div>
      ))}
      <span className="sr-only">Đang tải các cuộc trò chuyện trước đây…</span>
    </div>
  );
}

function ChatLandingTopBar({
  creating,
  loading,
  onCreate,
  total,
}: {
  creating: boolean;
  loading: boolean;
  onCreate: () => void;
  total: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        className={`${iconButtonClass} lg:hidden`}
        onClick={openChatNavigation}
        aria-label="Mở lịch sử trò chuyện"
        title="Lịch sử trò chuyện"
      >
        <History size={14} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold">Chat</p>
        <p className="hidden text-[10px] text-[var(--muted)] sm:block">
          {loading ? "Đang tải lịch sử…" : `${total} cuộc trò chuyện`}
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className={iconButtonClass}
        aria-label="Tạo cuộc trò chuyện mới"
        title="Tạo cuộc trò chuyện mới"
      >
        {creating ? (
          <LoaderCircle className="animate-spin" size={15} />
        ) : (
          <Plus size={15} />
        )}
      </button>
    </div>
  );
}

function ConversationWorkspace({
  conversationId,
  initialPrompt,
}: {
  conversationId: string;
  initialPrompt?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const topbarPortal = usePortalTarget("chat-topbar-portal");
  const [uploadState, setUploadState] = useState<
    Record<string, { name: string; progress: number; status: string }>
  >({});
  const [composerError, setComposerError] = useState("");
  const [mode, setMode] = useState<ChatMode>("investigate");
  const [thinkingMode, setThinkingMode] = useState<ChatThinkingMode>("deep");
  const [contextOpen, setContextOpen] = useState(false);
  const hydrated = useRef(false);
  const initialPromptSent = useRef(false);
  const detail = useQuery({
    queryKey: ["chat", "conversation", conversationId],
    queryFn: () =>
      fetchJson<ChatDetail>(`/api/chat/conversations/${conversationId}`),
    refetchInterval: (query) =>
      query.state.data?.attachments.some((item) =>
        ["uploading", "processing"].includes(item.status),
      )
        ? 1_500
        : false,
    staleTime: 5_000,
  });
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/chat/conversations/${conversationId}/messages`,
        prepareSendMessagesRequest({ messages }) {
          const message = messages.at(-1);
          const metadata = message?.metadata as ChatUIMessage["metadata"];
          return {
            body: {
              message,
              mode: metadata?.mode ?? mode,
              thinkingMode: metadata?.thinkingMode ?? thinkingMode,
            },
          };
        },
      }),
    [conversationId, mode, thinkingMode],
  );
  const chat = useChat<ChatUIMessage>({
    generateId: () => crypto.randomUUID(),
    id: conversationId,
    messages: detail.data?.messages ?? [],
    onFinish: () => {
      void detail.refetch();
      void queryClient.invalidateQueries({
        queryKey: ["chat", "conversations"],
      });
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport,
  });
  const sendChatMessage = useCallback(
    (text: string) =>
      chat.sendMessage({
        metadata: { mode, thinkingMode },
        text,
      }),
    [chat, mode, thinkingMode],
  );
  useEffect(() => {
    if (!detail.data || hydrated.current) return;
    chat.setMessages(detail.data.messages);
    hydrated.current = true;
  }, [chat, detail.data]);
  useEffect(() => {
    if (
      !initialPrompt?.trim() ||
      !detail.data ||
      initialPromptSent.current ||
      detail.data.messages.length > 0
    ) {
      return;
    }
    initialPromptSent.current = true;
    void sendChatMessage(initialPrompt.trim());
  }, [detail.data, initialPrompt, sendChatMessage]);
  const isBusy =
    chat.status === "submitted" ||
    chat.status === "streaming" ||
    Object.keys(uploadState).length > 0;

  async function submit(input: { files: FileUIPart[]; text: string }) {
    if (detail.data?.readOnly) return;
    setComposerError("");
    const attachmentIds: string[] = [];
    try {
      for (const part of input.files.slice(0, 5)) {
        const blob = await fetch(part.url).then((response) => response.blob());
        const key = crypto.randomUUID();
        setUploadState((current) => ({
          ...current,
          [key]: {
            name: part.filename ?? "Tệp",
            progress: 0,
            status: "Đang chuẩn bị",
          },
        }));
        try {
          const prepared = await fetchJson<{
            attachment: AttachmentRow;
            upload: {
              headers?: Record<string, string>;
              signedUrl: string;
              token?: string;
            };
          }>(`/api/chat/conversations/${conversationId}/attachments`, {
            body: JSON.stringify({
              contentType: inferContentType(
                part.filename,
                part.mediaType || blob.type,
              ),
              fileName: part.filename,
              size: blob.size,
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          await uploadBlob(blob, prepared.upload, (progress) =>
            setUploadState((current) => ({
              ...current,
              [key]: {
                ...current[key]!,
                progress,
                status: "Đang tải lên Drive",
              },
            })),
          );
          await fetchJson(
            `/api/chat/conversations/${conversationId}/attachments/${prepared.attachment.id}/finalize`,
            { method: "POST" },
          );
          setUploadState((current) => ({
            ...current,
            [key]: {
              ...current[key]!,
              progress: 100,
              status: "Đang trích xuất nội dung",
            },
          }));
          await waitUntilAttachmentReady(
            conversationId,
            prepared.attachment.id,
          );
          attachmentIds.push(prepared.attachment.id);
        } finally {
          setUploadState((current) => {
            const next = { ...current };
            delete next[key];
            return next;
          });
        }
      }
      if (input.text.trim() || attachmentIds.length > 0) {
        await chat.sendMessage({
          metadata: { attachmentIds, mode, thinkingMode },
          text: input.text.trim() || "Hãy phân tích các tệp đính kèm này.",
        });
      }
    } catch (error) {
      setComposerError(
        error instanceof Error
          ? error.message
          : "Không thể gửi tin nhắn hoặc xử lý tệp.",
      );
    }
  }

  if (detail.isPending) return <ChatLoading />;
  if (detail.isError || !detail.data)
    return (
      <ChatError
        message={detail.error?.message}
        onRetry={() => void detail.refetch()}
      />
    );

  const { conversation, readOnly } = detail.data;
  return (
    <>
      {topbarPortal
        ? createPortal(
            <ConversationTopBar
              conversation={conversation}
              onChanged={() =>
                void Promise.all([
                  detail.refetch(),
                  queryClient.invalidateQueries({
                    queryKey: ["chat", "conversations"],
                  }),
                ])
              }
              onDeleted={() => router.push("/chat")}
              onFork={(id) => router.push(`/chat/${id}`)}
              onOpenContext={() => setContextOpen(true)}
              readOnly={readOnly}
            />,
            topbarPortal,
          )
        : null}
      <Dialog open={contextOpen} onOpenChange={setContextOpen}>
        <DialogContent className="grid max-h-[min(88dvh,820px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-[var(--foreground)] sm:max-w-2xl sm:p-5">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>Ngữ cảnh và cấu hình</DialogTitle>
            <DialogDescription className="text-[var(--muted)]">
              Quản lý dữ liệu đã ghim, mô hình, tệp và hoạt động AI của cuộc trò
              chuyện này.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
            <ContextRail
              attachments={detail.data.attachments}
              conversation={conversation}
              conversationId={conversationId}
              modelRuns={detail.data.modelRuns}
              onChanged={() => void detail.refetch()}
              onUsePreset={(instructions) => void sendChatMessage(instructions)}
              readOnly={readOnly}
            />
          </div>
        </DialogContent>
      </Dialog>
      <div className="grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
        <Conversation className="min-h-0 bg-[var(--background)]">
          <ConversationContent className="mx-auto w-full max-w-5xl gap-5 px-4 py-5 sm:px-6">
            {chat.messages.length === 0 ? (
              <ChatStart
                mode={mode}
                onSelectMode={setMode}
                onSend={(value, selectedMode) =>
                  void chat.sendMessage({
                    metadata: { mode: selectedMode, thinkingMode },
                    text: value,
                  })
                }
              />
            ) : (
              chat.messages.map((message, index) => (
                <ChatMessageView
                  addToolApprovalResponse={chat.addToolApprovalResponse}
                  isLast={index === chat.messages.length - 1}
                  key={message.id}
                  message={message}
                  onRegenerate={() =>
                    chat.regenerate({ messageId: message.id })
                  }
                />
              ))
            )}
            {chat.status === "submitted" ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                <LoaderCircle className="animate-spin" size={14} /> Đang kiểm
                tra dữ liệu và công cụ…
              </div>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="max-h-[42dvh] overflow-y-auto overscroll-contain border-t border-[var(--border)] bg-[var(--background)] px-3 pb-2 pt-2 sm:px-4 sm:pb-3 xl:col-start-1">
          {Object.entries(uploadState).map(([key, item]) => (
            <div
              key={key}
              className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2.5"
            >
              <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-[var(--muted-strong)]">
                <span className="truncate">
                  {item.name} · {item.status}
                </span>
                <span>{item.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-[var(--brand)] transition-[width]"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          ))}
          {readOnly ? (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-soft)] p-3 text-xs text-[var(--muted-strong)]">
              <span>Chat chia sẻ ở chế độ chỉ đọc.</span>
              <ConversationActions
                conversation={conversation}
                readOnly
                onChanged={() => undefined}
                onFork={(id) => router.push(`/chat/${id}`)}
                onDeleted={() => undefined}
              />
            </div>
          ) : (
            <>
              {composerError ? (
                <p
                  className="mb-2 rounded-lg bg-[var(--danger-soft)] p-2.5 text-xs font-semibold text-[var(--danger-strong)]"
                  role="alert"
                >
                  {composerError}
                </p>
              ) : null}
              <PromptInput
                accept={accept}
                globalDrop
                inputGroupClassName="rounded-xl border-[var(--border-strong)] bg-[var(--surface-elevated)] shadow-[0_8px_24px_rgb(15_23_42/0.06)] transition-[border-color,box-shadow] focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--brand)_22%,transparent)] dark:bg-[var(--surface-elevated)] dark:shadow-[0_10px_28px_rgb(0_0_0/0.18)]"
                maxFiles={5}
                maxFileSize={25 * 1024 * 1024}
                multiple
                onError={(error) => setComposerError(error.message)}
                onSubmit={submit}
              >
                <PromptInputHeader className="bg-[var(--surface-elevated)] px-2.5 pb-0 pt-0 dark:bg-[var(--surface-elevated)]">
                  <SelectedPromptAttachments />
                </PromptInputHeader>
                <PromptInputBody>
                  <PromptInputTextarea
                    className="min-h-14 bg-[var(--surface-elevated)] px-3 pb-1 pt-2.5 text-[13px] font-medium leading-5 text-[var(--foreground)] placeholder:text-[var(--muted)] dark:bg-[var(--surface-elevated)]"
                    disabled={isBusy}
                    placeholder="Hỏi về bằng chứng, lần quét, chủ đề hoặc nhờ soạn bản nháp…"
                  />
                  <div className="sr-only">
                    Enter để gửi · Shift + Enter để xuống dòng
                  </div>
                </PromptInputBody>
                <PromptInputFooter className="items-center bg-[var(--surface-elevated)] px-2 pb-2 pt-1 dark:bg-[var(--surface-elevated)]">
                  <PromptInputTools className="flex-wrap gap-1.5">
                    <PromptInputActionMenu>
                      <PromptInputActionMenuTrigger
                        aria-label="Đính kèm tệp"
                        className="size-8 rounded-lg border border-transparent text-[var(--muted-strong)] hover:border-[var(--border)] hover:bg-[var(--surface-soft)]"
                        title="Đính kèm tệp"
                      >
                        <Paperclip size={14} />
                      </PromptInputActionMenuTrigger>
                      <PromptInputActionMenuContent>
                        <PromptInputActionAddAttachments label="Tải tệp lên Tuturuuu Drive" />
                      </PromptInputActionMenuContent>
                    </PromptInputActionMenu>
                    <ChatModeControl mode={mode} onChange={setMode} />
                    <ThinkingModeControl
                      mode={thinkingMode}
                      onChange={setThinkingMode}
                    />
                    <button
                      type="button"
                      onClick={() => setContextOpen(true)}
                      className="hidden h-8 items-center gap-1.5 rounded-lg border border-transparent px-2 text-[10px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border)] hover:bg-[var(--surface-soft)] sm:inline-flex"
                      title="Xem bằng chứng và nội dung đã ghim"
                    >
                      <ShieldCheck size={13} /> Ngữ cảnh
                      <span className="rounded-md bg-[var(--surface-soft)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]">
                        {conversation.pinnedContext.length}
                      </span>
                    </button>
                  </PromptInputTools>
                  <PromptInputSubmit
                    aria-label={isBusy ? "Dừng tạo nội dung" : "Gửi tin nhắn"}
                    className="size-8 rounded-lg bg-[var(--brand)] text-white shadow-sm hover:bg-[var(--brand-strong)] focus-visible:ring-[var(--brand)] disabled:opacity-50"
                    disabled={isBusy}
                    onStop={chat.stop}
                    status={chat.status}
                  />
                </PromptInputFooter>
              </PromptInput>
              <p className="mt-1.5 text-center text-[9px] text-[var(--muted)]">
                AI có thể sai. Kiểm tra nguồn và phê duyệt mọi thay đổi nội bộ.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ConversationTopBar({
  conversation,
  onChanged,
  onDeleted,
  onFork,
  onOpenContext,
  readOnly,
}: {
  conversation: ConversationRow;
  onChanged: () => void;
  onDeleted: () => void;
  onFork: (id: string) => void;
  onOpenContext: () => void;
  readOnly: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        className={`${iconButtonClass} lg:hidden`}
        onClick={openChatNavigation}
        aria-label="Mở lịch sử trò chuyện"
        title="Lịch sử trò chuyện"
      >
        <History size={14} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-extrabold text-[var(--foreground)]">
            {conversation.title}
          </h1>
          <span className="hidden shrink-0 rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--muted-strong)] md:inline-flex">
            {readOnly
              ? "Chỉ đọc"
              : conversation.visibility === "workspace"
                ? "Workspace"
                : "Riêng tư"}
          </span>
        </div>
        <p className="hidden truncate text-[10px] text-[var(--muted)] lg:block">
          {readOnly
            ? `Được chia sẻ bởi ${conversation.ownerDisplayName ?? "thành viên"}`
            : "Mọi thay đổi đều cần được xác nhận"}
        </p>
      </div>
      <button
        type="button"
        className={iconButtonClass}
        onClick={onOpenContext}
        aria-haspopup="dialog"
        aria-label="Mở ngữ cảnh và cấu hình"
        title="Ngữ cảnh và cấu hình"
      >
        <SlidersHorizontal size={14} />
      </button>
      <ConversationActions
        conversation={conversation}
        readOnly={readOnly}
        onChanged={onChanged}
        onFork={onFork}
        onDeleted={onDeleted}
      />
    </div>
  );
}

const chatModes: Array<{
  description: string;
  icon: typeof Search;
  label: string;
  starter: string;
  value: ChatMode;
}> = [
  {
    description: "Trả lời trực tiếp",
    icon: Zap,
    label: "Hỏi nhanh",
    starter: "Tóm tắt những rủi ro mới nhất cần chú ý.",
    value: "ask",
  },
  {
    description: "Đối chiếu bằng chứng",
    icon: Search,
    label: "Điều tra",
    starter: "Điều tra chủ đề nổi bật và đối chiếu các bằng chứng liên quan.",
    value: "investigate",
  },
  {
    description: "Nội dung cần duyệt",
    icon: WandSparkles,
    label: "Soạn thảo",
    starter:
      "Soạn một phản hồi có căn cứ, tự nhiên và để ở trạng thái cần duyệt.",
    value: "draft",
  },
  {
    description: "Phân tích chuyên sâu",
    icon: FileText,
    label: "Báo cáo",
    starter:
      "Lập báo cáo chuyên sâu về rủi ro, xu hướng và khuyến nghị hành động.",
    value: "report",
  },
];

function ChatStart({
  mode,
  onSelectMode,
  onSend,
}: {
  mode: ChatMode;
  onSelectMode: (mode: ChatMode) => void;
  onSend: (value: string, mode: ChatMode) => void;
}) {
  return (
    <div className="mx-auto my-auto w-full max-w-2xl py-8">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          <Brain size={20} />
        </span>
        <div>
          <h3 className="text-base font-extrabold text-[var(--foreground)]">
            Trợ lý phân tích CyberShield35
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Chọn mục tiêu. Trợ lý sẽ tìm bằng chứng, sử dụng công cụ và xin xác
            nhận trước mọi thay đổi.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {chatModes.map((item) => {
          const Icon = item.icon;
          const selected = item.value === mode;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                onSelectMode(item.value);
                onSend(item.starter, item.value);
              }}
              className={`group rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]"}`}
            >
              <div className="flex items-center gap-2">
                <Icon
                  size={15}
                  className={
                    selected
                      ? "text-[var(--accent-strong)]"
                      : "text-[var(--muted-strong)]"
                  }
                />
                <span className="text-xs font-extrabold text-[var(--foreground)]">
                  {item.label}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                {item.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChatModeControl({
  mode,
  onChange,
}: {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
}) {
  const selectedMode =
    chatModes.find((item) => item.value === mode) ?? chatModes[0]!;
  const Icon = selectedMode.icon;
  return (
    <label
      className="relative inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[10px] font-extrabold text-[var(--foreground)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--brand)_18%,transparent)]"
      title={`${selectedMode.label}: ${selectedMode.description}`}
    >
      <span className="sr-only">Chế độ Chat</span>
      <Icon size={12} className="text-[var(--brand-strong)]" />
      <span>{selectedMode.label}</span>
      <select
        value={mode}
        onChange={(event) => onChange(event.target.value as ChatMode)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
        aria-label="Chọn mục tiêu trò chuyện"
      >
        {chatModes.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none text-[var(--muted)]"
        size={11}
      />
    </label>
  );
}

function ThinkingModeControl({
  mode,
  onChange,
}: {
  mode: ChatThinkingMode;
  onChange: (mode: ChatThinkingMode) => void;
}) {
  return (
    <div
      className="inline-flex h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5"
      aria-label="Mức suy xét"
    >
      <button
        type="button"
        onClick={() => onChange("fast")}
        className={`inline-flex items-center gap-1 rounded-md px-2 text-[10px] font-extrabold transition ${mode === "fast" ? "bg-[var(--success-soft)] text-[var(--brand-strong)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--muted-strong)]"}`}
        title="Nhanh: trả lời trực tiếp, dùng ít bước công cụ"
      >
        <Zap size={10} /> Nhanh
      </button>
      <button
        type="button"
        onClick={() => onChange("deep")}
        className={`inline-flex items-center gap-1 rounded-md px-2 text-[10px] font-extrabold transition ${mode === "deep" ? "bg-[var(--success-soft)] text-[var(--brand-strong)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--muted-strong)]"}`}
        title="Sâu: đối chiếu nhiều bước và nhiều nguồn"
      >
        <Brain size={10} /> Sâu
      </button>
    </div>
  );
}

function SelectedPromptAttachments() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <Attachments variant="inline">
      {attachments.files.map((file) => (
        <Attachment
          data={file}
          key={file.id}
          onRemove={() => attachments.remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove label="Bỏ tệp" />
        </Attachment>
      ))}
    </Attachments>
  );
}

function ChatMessageView({
  addToolApprovalResponse,
  isLast,
  message,
  onRegenerate,
}: {
  addToolApprovalResponse: (input: {
    approved: boolean;
    id: string;
  }) => void | PromiseLike<void>;
  isLast: boolean;
  message: ChatUIMessage;
  onRegenerate: () => Promise<void>;
}) {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  const toolParts = message.parts.filter(isToolUIPart);
  const toolNeedsAttention = toolParts.some(
    (part) =>
      part.state === "approval-requested" ||
      part.state === "input-streaming" ||
      part.state === "input-available",
  );
  return (
    <Message from={message.role}>
      <MessageContent>
        {message.parts.map((part, index) => {
          if (part.type === "text")
            return (
              <MessageResponse key={`${message.id}-${index}`}>
                {part.text}
              </MessageResponse>
            );
          if (part.type === "reasoning")
            return (
              <details
                className="group rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2"
                key={`${message.id}-reasoning-${index}`}
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 text-[10px] font-extrabold text-[var(--muted-strong)]">
                  <Brain size={13} className="text-[var(--accent-strong)]" />{" "}
                  Cách trợ lý kiểm tra{" "}
                  <ChevronDown
                    size={12}
                    className="ml-auto transition group-open:rotate-180"
                  />
                </summary>
                <div className="mt-2 border-t border-[var(--border)] pt-2 text-[11px] leading-5 text-[var(--muted)]">
                  <MessageResponse>{part.text}</MessageResponse>
                </div>
              </details>
            );
          if (part.type === "source-url")
            return (
              <a
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-[10px] font-bold text-[var(--accent-strong)] transition hover:border-[var(--accent)]"
                href={part.url}
                key={part.sourceId}
                target="_blank"
                rel="noreferrer"
              >
                <FileText size={13} />
                <span className="truncate">{part.title ?? part.url}</span>
              </a>
            );
          if (isToolUIPart(part)) return null;
          return null;
        })}
        {toolParts.length ? (
          <details
            className="group overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]"
            open={toolNeedsAttention || undefined}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[10px] font-extrabold text-[var(--muted-strong)]">
              <Wrench size={13} className="text-[var(--accent-strong)]" /> Hoạt
              động công cụ{" "}
              <span className="rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[8px]">
                {toolParts.length}
              </span>
              <ChevronDown
                size={12}
                className="ml-auto transition group-open:rotate-180"
              />
            </summary>
            <div className="space-y-2 border-t border-[var(--border)] p-2">
              {toolParts.map((part) => (
                <Tool
                  defaultOpen={part.state === "approval-requested"}
                  key={part.toolCallId}
                >
                  {part.type === "dynamic-tool" ? (
                    <ToolHeader
                      state={part.state}
                      title={toolLabel(getToolName(part))}
                      toolName={part.toolName}
                      type={part.type}
                    />
                  ) : (
                    <ToolHeader
                      state={part.state}
                      title={toolLabel(getToolName(part))}
                      type={part.type}
                    />
                  )}
                  <ToolContent>
                    <ToolInput input={part.input} />
                    <Confirmation approval={part.approval} state={part.state}>
                      <ConfirmationTitle>
                        Cho phép Chat thực hiện thay đổi nội bộ này?
                      </ConfirmationTitle>
                      <ConfirmationRequest>
                        <ConfirmationActions>
                          <ConfirmationAction
                            variant="outline"
                            onClick={() =>
                              addToolApprovalResponse({
                                approved: false,
                                id: part.approval!.id,
                              })
                            }
                          >
                            Từ chối
                          </ConfirmationAction>
                          <ConfirmationAction
                            onClick={() =>
                              addToolApprovalResponse({
                                approved: true,
                                id: part.approval!.id,
                              })
                            }
                          >
                            Phê duyệt
                          </ConfirmationAction>
                        </ConfirmationActions>
                      </ConfirmationRequest>
                    </Confirmation>
                    <ToolOutput
                      errorText={
                        "errorText" in part ? part.errorText : undefined
                      }
                      output={"output" in part ? part.output : undefined}
                    />
                  </ToolContent>
                </Tool>
              ))}
            </div>
          </details>
        ) : null}
      </MessageContent>
      <MessageActions className={message.role === "user" ? "justify-end" : ""}>
        <MessageAction
          label="Sao chép"
          onClick={() => void navigator.clipboard.writeText(text)}
          tooltip="Sao chép"
        >
          <Copy size={13} />
        </MessageAction>
        {message.role === "assistant" && isLast ? (
          <MessageAction
            label="Tạo lại"
            onClick={() => void onRegenerate()}
            tooltip="Tạo lại"
          >
            <RefreshCw size={13} />
          </MessageAction>
        ) : null}
      </MessageActions>
    </Message>
  );
}

function ContextRail({
  attachments,
  conversation,
  conversationId,
  modelRuns,
  onChanged,
  onUsePreset,
  readOnly,
}: {
  attachments: AttachmentRow[];
  conversation: ConversationRow;
  conversationId: string;
  modelRuns: ChatDetail["modelRuns"];
  onChanged: () => void;
  onUsePreset: (instructions: string) => void;
  readOnly: boolean;
}) {
  return (
    <div className="space-y-2 p-3">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex items-center justify-between gap-2">
          <p className={railTitleClass}>Ngữ cảnh đã ghim</p>
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[9px] font-extrabold text-[var(--accent-strong)]">
            {conversation.pinnedContext.length}
          </span>
        </div>
        {conversation.pinnedContext.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {conversation.pinnedContext.map((item) => (
              <a
                key={`${item.type}:${item.id}`}
                href={item.href}
                className="max-w-full truncate rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-bold text-[var(--accent-strong)]"
              >
                {item.type} · {item.label}
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">
            Chưa ghim dữ liệu. Công cụ vẫn có thể tìm trong workspace.
          </p>
        )}
      </div>
      <details className={railSectionClass} open>
        <summary className={railSummaryClass}>
          <SlidersHorizontal size={13} /> Mô hình và ngữ cảnh{" "}
          <ChevronDown
            size={12}
            className="ml-auto transition group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-[var(--border)] p-3">
          <ChatGenerationControls
            conversation={conversation}
            onChanged={onChanged}
            onUsePreset={onUsePreset}
            readOnly={readOnly}
          />
        </div>
      </details>
      <details className={railSectionClass}>
        <summary className={railSummaryClass}>
          <FileText size={13} /> Tệp Drive{" "}
          <span className="text-[9px] text-[var(--muted)]">
            {attachments.length}
          </span>
          <ChevronDown
            size={12}
            className="ml-auto transition group-open:rotate-180"
          />
        </summary>
        <div className="space-y-2 border-t border-[var(--border)] p-2">
          {attachments.length ? (
            attachments.map((item) => (
              <div
                key={item.id}
                className="rounded-lg bg-[var(--surface-soft)] p-2.5"
              >
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 shrink-0" size={14} />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-bold">
                      {item.fileName}
                    </p>
                    <p className="mt-1 text-[9px] text-[var(--muted)]">
                      {attachmentStatus(item.status)} ·{" "}
                      {formatBytes(item.sizeBytes)}
                    </p>
                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          void openAttachment(conversationId, item.id)
                        }
                        className="text-[10px] font-bold text-[var(--accent-strong)]"
                      >
                        Tải xuống
                      </button>
                      {item.status === "failed" ? (
                        <button
                          type="button"
                          onClick={() =>
                            void fetch(
                              `/api/chat/conversations/${conversationId}/attachments/${item.id}`,
                              { method: "POST" },
                            )
                          }
                          className="text-[10px] font-bold text-[var(--danger-strong)]"
                        >
                          Thử lại
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="p-2 text-[10px] text-[var(--muted)]">Chưa có tệp.</p>
          )}
        </div>
      </details>
      <details className={railSectionClass}>
        <summary className={railSummaryClass}>
          <Brain size={13} /> Hoạt động AI{" "}
          <span className="text-[9px] text-[var(--muted)]">
            {modelRuns.length}
          </span>
          <ChevronDown
            size={12}
            className="ml-auto transition group-open:rotate-180"
          />
        </summary>
        <div className="space-y-2 border-t border-[var(--border)] p-2">
          {modelRuns.length ? (
            modelRuns.slice(0, 5).map((run) => (
              <div
                key={run.id}
                className="rounded-lg bg-[var(--surface-soft)] p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[10px] font-bold">
                    {run.provider} · {run.model}
                  </p>
                  <span className="text-[9px] font-bold text-[var(--muted)]">
                    {run.status}
                  </span>
                </div>
                <p className="mt-1 text-[9px] text-[var(--muted)]">
                  {run.stepCount} bước ·{" "}
                  {(run.inputTokens ?? 0) + (run.outputTokens ?? 0)} token ·{" "}
                  {run.latencyMs ?? 0} ms
                </p>
              </div>
            ))
          ) : (
            <p className="p-2 text-[10px] text-[var(--muted)]">
              Chưa có hoạt động.
            </p>
          )}
        </div>
      </details>
      <div className="rounded-lg bg-[var(--success-soft)] p-3 text-[10px] leading-5 text-[var(--success-strong)]">
        <ShieldCheck className="mb-1.5" size={14} />
        Thay đổi cần xác nhận. Chat không thể xuất bản ra ngoài.
      </div>
    </div>
  );
}

function ChatGenerationControls({
  conversation,
  onChanged,
  onUsePreset,
  readOnly,
}: {
  conversation: ConversationRow;
  onChanged: () => void;
  onUsePreset: (instructions: string) => void;
  readOnly: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetInstructions, setPresetInstructions] = useState("");
  const [presetVisibility, setPresetVisibility] = useState<
    "private" | "workspace"
  >("private");
  const [pinType, setPinType] = useState<
    "scan" | "evidence" | "topic" | "draft" | "article"
  >("evidence");
  const [pinId, setPinId] = useState("");
  const [pinLabel, setPinLabel] = useState("");
  const models = useQuery({
    queryKey: ["ai", "models"],
    queryFn: () =>
      fetchJson<{ defaultModel: string; models: string[] }>("/api/ai/models"),
  });
  const presets = useQuery({
    queryKey: ["ai", "presets"],
    queryFn: () =>
      fetchJson<{
        presets: Array<{
          id: string;
          instructions: string;
          name: string;
          visibility: "private" | "workspace";
        }>;
      }>("/api/ai/presets"),
  });
  async function patch(payload: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetchJson(`/api/chat/conversations/${conversation.id}`, {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      onChanged();
    } finally {
      setSaving(false);
    }
  }
  async function createPreset() {
    if (!presetName.trim() || !presetInstructions.trim()) return;
    setSaving(true);
    try {
      await fetchJson("/api/ai/presets", {
        body: JSON.stringify({
          instructions: presetInstructions,
          name: presetName,
          visibility: presetVisibility,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setPresetName("");
      setPresetInstructions("");
      await presets.refetch();
    } finally {
      setSaving(false);
    }
  }
  async function addPinnedContext() {
    if (!pinId.trim() || !pinLabel.trim()) return;
    await patch({
      pinnedContext: [
        ...conversation.pinnedContext.filter(
          (item) => !(item.type === pinType && item.id === pinId.trim()),
        ),
        {
          href: `/${pinType === "scan" ? "scans" : pinType === "evidence" ? "evidence" : pinType === "topic" ? "topics" : pinType === "draft" ? "drafts" : "articles"}/${pinId.trim()}`,
          id: pinId.trim(),
          label: pinLabel.trim(),
          type: pinType,
        },
      ],
    });
    setPinId("");
    setPinLabel("");
  }
  return (
    <div>
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={12} />
        <p className={railTitleClass}>Mô hình & cách trả lời</p>
      </div>
      <div className="mt-2 space-y-2">
        <select
          disabled={readOnly || saving}
          value={conversation.model ?? models.data?.defaultModel ?? ""}
          onChange={(event) => void patch({ model: event.target.value })}
          className={railInputClass}
        >
          {models.data?.models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        <label className="block text-[9px] font-bold text-[var(--muted)]">
          Độ sáng tạo · {(conversation.temperature / 100).toFixed(1)}
          <input
            type="range"
            min={0}
            max={200}
            step={10}
            disabled={readOnly || saving}
            defaultValue={conversation.temperature}
            onPointerUp={(event) =>
              void patch({
                temperature: Number(event.currentTarget.value) / 100,
              })
            }
            className="mt-1 w-full"
          />
        </label>
        <select
          disabled={readOnly || saving}
          value={conversation.contextBudget}
          onChange={(event) =>
            void patch({ contextBudget: Number(event.target.value) })
          }
          className={railInputClass}
        >
          <option value={16000}>Ngữ cảnh 16K</option>
          <option value={32000}>Ngữ cảnh 32K</option>
          <option value={64000}>Ngữ cảnh 64K</option>
          <option value={128000}>Ngữ cảnh 128K</option>
        </select>
      </div>
      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <p className="text-[9px] font-bold uppercase text-[var(--muted)]">
          Ghim ngữ cảnh
        </p>
        <div className="mt-2 space-y-2">
          {conversation.pinnedContext.map((item) => (
            <div
              key={`${item.type}:${item.id}`}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[9px]"
            >
              <span className="truncate font-bold">
                {item.type} · {item.label}
              </span>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() =>
                    void patch({
                      pinnedContext: conversation.pinnedContext.filter(
                        (candidate) => candidate !== item,
                      ),
                    })
                  }
                  className="text-[var(--danger-strong)]"
                  aria-label={`Bỏ ghim ${item.label}`}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {!readOnly ? (
            <details>
              <summary className="cursor-pointer text-[9px] font-bold text-[var(--accent-strong)]">
                Ghim ID mới
              </summary>
              <div className="mt-2 space-y-2">
                <select
                  value={pinType}
                  onChange={(event) =>
                    setPinType(event.target.value as typeof pinType)
                  }
                  className={railInputClass}
                >
                  <option value="evidence">Evidence</option>
                  <option value="scan">Scan</option>
                  <option value="topic">Chủ đề</option>
                  <option value="draft">Bản nháp</option>
                  <option value="article">Bài viết</option>
                </select>
                <input
                  value={pinId}
                  onChange={(event) => setPinId(event.target.value)}
                  placeholder="ID chuẩn"
                  className={railInputClass}
                />
                <input
                  value={pinLabel}
                  onChange={(event) => setPinLabel(event.target.value)}
                  placeholder="Nhãn dễ nhận biết"
                  className={railInputClass}
                />
                <button
                  type="button"
                  onClick={() => void addPinnedContext()}
                  className={smallButtonClass}
                >
                  Ghim ngữ cảnh
                </button>
              </div>
            </details>
          ) : null}
        </div>
      </div>
      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <p className="text-[9px] font-bold uppercase text-[var(--muted)]">
          Preset lời nhắc
        </p>
        <div className="mt-2 space-y-1.5">
          {presets.data?.presets.slice(0, 5).map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={readOnly}
              onClick={() => onUsePreset(preset.instructions)}
              className="flex w-full items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-left text-[9px] font-bold"
            >
              <span className="truncate">{preset.name}</span>
              <span className="text-[8px] text-[var(--muted)]">
                {preset.visibility === "workspace" ? "Chung" : "Riêng"}
              </span>
            </button>
          ))}
        </div>
        {!readOnly ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-[9px] font-bold text-[var(--accent-strong)]">
              Tạo preset riêng
            </summary>
            <div className="mt-2 space-y-2">
              <input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="Tên preset"
                className={railInputClass}
              />
              <textarea
                value={presetInstructions}
                onChange={(event) => setPresetInstructions(event.target.value)}
                rows={3}
                placeholder="Hướng dẫn tái sử dụng…"
                className={railInputClass}
              />
              <select
                value={presetVisibility}
                onChange={(event) =>
                  setPresetVisibility(
                    event.target.value as "private" | "workspace",
                  )
                }
                className={railInputClass}
              >
                <option value="private">Riêng tư</option>
                <option value="workspace">Chia sẻ workspace</option>
              </select>
              <button
                type="button"
                disabled={saving}
                onClick={() => void createPreset()}
                className={smallButtonClass}
              >
                Lưu preset
              </button>
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function ConversationActions({
  conversation,
  onChanged,
  onDeleted,
  onFork,
  readOnly,
}: {
  conversation: ConversationRow;
  onChanged: () => void;
  onDeleted: () => void;
  onFork: (id: string) => void;
  readOnly: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  async function patch(payload: object) {
    await fetchJson(`/api/chat/conversations/${conversation.id}`, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    onChanged();
  }
  async function deleteConversation() {
    await fetchJson(`/api/chat/conversations/${conversation.id}`, {
      method: "DELETE",
    });
    onDeleted();
  }
  if (readOnly)
    return (
      <button
        type="button"
        onClick={async () => {
          const result = await fetchJson<{ conversation: ConversationRow }>(
            `/api/chat/conversations/${conversation.id}/fork`,
            { method: "POST" },
          );
          onFork(result.conversation.id);
        }}
        className={`${smallButtonClass} px-2 sm:px-3`}
      >
        <GitFork size={13} />
        <span className="hidden sm:inline">Tạo bản riêng</span>
      </button>
    );
  return (
    <div className="flex items-center gap-1">
      {renaming ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim())
              void patch({ title: title.trim() }).then(() =>
                setRenaming(false),
              );
          }}
        >
          <input
            autoFocus
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            className="h-8 w-28 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs sm:w-40"
          />
          <button className={iconButtonClass} type="submit">
            <Pencil size={13} />
          </button>
        </form>
      ) : (
        <>
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              title="Đổi tên"
              aria-label="Đổi tên cuộc trò chuyện"
              onClick={() => setRenaming(true)}
              className={iconButtonClass}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              title={
                conversation.visibility === "workspace"
                  ? "Chuyển thành riêng tư"
                  : "Chia sẻ trong workspace"
              }
              aria-label={
                conversation.visibility === "workspace"
                  ? "Chuyển thành riêng tư"
                  : "Chia sẻ trong workspace"
              }
              onClick={() =>
                void patch({
                  visibility:
                    conversation.visibility === "workspace"
                      ? "private"
                      : "workspace",
                })
              }
              className={iconButtonClass}
            >
              {conversation.visibility === "workspace" ? (
                <Users size={14} />
              ) : (
                <Share2 size={14} />
              )}
            </button>
            <button
              type="button"
              title={conversation.archivedAt ? "Bỏ lưu trữ" : "Lưu trữ"}
              aria-label={conversation.archivedAt ? "Bỏ lưu trữ" : "Lưu trữ"}
              onClick={() => void patch({ archived: !conversation.archivedAt })}
              className={iconButtonClass}
            >
              <Archive size={14} />
            </button>
            <button
              type="button"
              title="Xóa"
              aria-label="Xóa cuộc trò chuyện"
              onClick={() => void deleteConversation()}
              className={iconButtonClass}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`${iconButtonClass} sm:hidden`}
                aria-label="Thao tác với cuộc trò chuyện"
                title="Thao tác"
              >
                <MoreHorizontal size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
            >
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <Pencil size={14} /> Đổi tên
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  void patch({
                    visibility:
                      conversation.visibility === "workspace"
                        ? "private"
                        : "workspace",
                  })
                }
              >
                {conversation.visibility === "workspace" ? (
                  <Users size={14} />
                ) : (
                  <Share2 size={14} />
                )}
                {conversation.visibility === "workspace"
                  ? "Chuyển thành riêng tư"
                  : "Chia sẻ trong workspace"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  void patch({ archived: !conversation.archivedAt })
                }
              >
                <Archive size={14} />
                {conversation.archivedAt ? "Bỏ lưu trữ" : "Lưu trữ"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[var(--danger-strong)] focus:text-[var(--danger-strong)]"
                onSelect={() => void deleteConversation()}
              >
                <Trash2 size={14} /> Xóa cuộc trò chuyện
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}

async function waitUntilAttachmentReady(
  conversationId: string,
  attachmentId: string,
) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const detail = await fetchJson<ChatDetail>(
      `/api/chat/conversations/${conversationId}`,
    );
    const attachment = detail.attachments.find(
      (item) => item.id === attachmentId,
    );
    if (attachment?.status === "ready") return;
    if (attachment?.status === "failed")
      throw new Error(attachment.errorMessage ?? "Không thể xử lý tệp");
    await new Promise((resolve) => window.setTimeout(resolve, 1_000));
  }
  throw new Error(
    "Xử lý tệp mất quá nhiều thời gian. Bạn có thể thử lại từ ngữ cảnh Chat.",
  );
}

function uploadBlob(
  blob: Blob,
  upload: {
    headers?: Record<string, string>;
    signedUrl: string;
    token?: string;
  },
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", upload.signedUrl);
    for (const [key, value] of Object.entries(upload.headers ?? {}))
      xhr.setRequestHeader(key, value);
    if (upload.token)
      xhr.setRequestHeader("Authorization", `Bearer ${upload.token}`);
    xhr.upload.onprogress = (event) =>
      onProgress(
        event.lengthComputable
          ? Math.round((event.loaded / event.total) * 100)
          : 0,
      );
    xhr.onerror = () =>
      reject(new Error("Không thể tải tệp lên Tuturuuu Drive"));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Tải tệp thất bại (${xhr.status})`));
    xhr.send(blob);
  });
}

function inferContentType(fileName?: string, candidate?: string) {
  if (candidate && candidate !== "application/octet-stream") return candidate;
  const extension = fileName?.split(".").pop()?.toLowerCase();
  return (
    (
      {
        csv: "text/csv",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        jpeg: "image/jpeg",
        jpg: "image/jpeg",
        json: "application/json",
        md: "text/markdown",
        pdf: "application/pdf",
        png: "image/png",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        txt: "text/plain",
        webp: "image/webp",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      } as Record<string, string>
    )[extension ?? ""] ?? "application/octet-stream"
  );
}

async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : `Yêu cầu thất bại (${response.status})`,
    );
  return body as T;
}

async function openAttachment(conversationId: string, attachmentId: string) {
  const result = await fetchJson<{ signedUrl: string }>(
    `/api/chat/conversations/${conversationId}/attachments/${attachmentId}`,
  );
  window.open(result.signedUrl, "_blank", "noopener,noreferrer");
}

function ChatLoading() {
  return (
    <div className="grid h-full min-h-0 place-items-center">
      <LoaderCircle className="animate-spin text-[var(--brand)]" />
    </div>
  );
}
function ChatError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="grid h-full min-h-0 place-items-center overflow-y-auto p-6 text-center">
      <div>
        <p className="text-sm font-bold text-[var(--danger-strong)]">
          {message ?? "Không thể tải Chat."}
        </p>
        <button type="button" onClick={onRetry} className={smallButtonClass}>
          Thử lại
        </button>
      </div>
    </div>
  );
}
function relativeTime(value: string) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60_000),
  );
  return minutes < 1
    ? "Vừa xong"
    : minutes < 60
      ? `${minutes} phút`
      : new Intl.DateTimeFormat("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }).format(new Date(value));
}
function attachmentStatus(value: AttachmentRow["status"]) {
  return (
    {
      pending_upload: "Chờ tải",
      uploading: "Đang tải",
      processing: "Đang xử lý",
      ready: "Sẵn sàng",
      failed: "Lỗi",
      deleting: "Đang xóa",
      deleted: "Đã xóa",
    } as const
  )[value];
}
function formatBytes(value: number) {
  return value < 1024 * 1024
    ? `${Math.ceil(value / 1024)} KB`
    : `${(value / 1024 / 1024).toFixed(1)} MB`;
}
function toolLabel(value: string) {
  return (
    (
      {
        searchEvidence: "Tìm bằng chứng",
        getEvidence: "Đọc bằng chứng",
        listScans: "Danh sách scan",
        getScan: "Chi tiết scan",
        listTopics: "Chủ đề",
        getInsights: "Insight",
        searchAttachments: "Tìm trong tệp",
        createDraft: "Lưu bản nháp",
        createArticle: "Tạo bài viết",
        updateArticleDraft: "Cập nhật bài viết",
        listArticles: "Danh sách bài viết",
        getArticle: "Đọc bài viết",
        listZaloAccounts: "Zalo OA",
        runScanNow: "Quét ngay",
        createScanFromAttachment: "Tạo scan từ tệp",
        updateEvidenceTriage: "Cập nhật xử lý",
      } as Record<string, string>
    )[value] ?? value
  );
}

const iconButtonClass =
  "inline-flex size-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]";
const smallButtonClass =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[10px] font-bold text-[var(--muted-strong)]";
const railTitleClass =
  "text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]";
const railInputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[10px] outline-none focus:border-[var(--accent)]";
const railSectionClass =
  "group overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]";
const railSummaryClass =
  "flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[10px] font-extrabold text-[var(--muted-strong)]";
