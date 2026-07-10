import {
	Bot,
	MessageCircle,
	Send,
	ShieldCheck,
	Sparkles,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import type { ChatMessage } from "@/components/dashboard/types";
import { Panel, PanelHeader, SecondaryButton } from "@/components/dashboard/ui-primitives";

const promptCards = [
	{
		title: "Tóm tắt rủi ro",
		prompt:
			"Tóm tắt rủi ro chính của scan hiện tại bằng tiếng Việt, ưu tiên các điểm cần người vận hành kiểm chứng.",
	},
	{
		title: "Kiểm tra bằng chứng",
		prompt:
			"Kiểm tra xem các lập luận phản hồi hiện tại đã bám sát bằng chứng hay chưa và chỉ ra điểm còn thiếu.",
	},
	{
		title: "Soạn hướng xử lý",
		prompt:
			"Đề xuất hướng xử lý nội bộ theo từng bước, không tự động đăng tải và không thêm tuyên bố ngoài bằng chứng.",
	},
];

export function ChatPage({
	isSending,
	messages,
	onOpenComposer,
	showHeader = true,
}: {
	isSending: boolean;
	messages: ChatMessage[];
	onOpenComposer: (preset?: string) => void;
	showHeader?: boolean;
}) {
	return (
		<div className="flex min-h-[calc(100vh-7rem)] flex-col gap-5">
			{showHeader ? (
				<PageHeader
					icon={MessageCircle}
					title="Chat LLM"
					description="Trao đổi với LLM về phân tích, bằng chứng và phản hồi nội bộ."
					actions={
						<SecondaryButton onClick={() => onOpenComposer()}>
							<Send size={14} /> Soạn tin nhắn
						</SecondaryButton>
					}
				/>
			) : null}
			<div className="grid flex-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
				<Panel className="flex min-h-[520px] flex-col">
					<PanelHeader
						title="Phiên trao đổi"
						description="Tin nhắn được giữ trong phiên trình duyệt hiện tại."
						action={
							<span className="inline-flex h-6 min-w-[72px] items-center justify-center rounded-md bg-[var(--accent-soft)] px-2 text-[11px] font-bold text-[var(--accent-strong)]">
								{messages.length} tin
							</span>
						}
					/>
					<div className="flex-1 space-y-3 overflow-y-auto p-4">
						{messages.map((message) => (
							<MessageBubble key={message.id} message={message} />
						))}
						{isSending ? (
							<div className="max-w-3xl rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-[12px] font-semibold text-[var(--muted)]">
								LLM đang chuẩn bị phản hồi...
							</div>
						) : null}
					</div>
					<div className="border-t border-[var(--border)] p-3">
						<SecondaryButton onClick={() => onOpenComposer()}>
							<Send size={14} /> Thêm tin nhắn
						</SecondaryButton>
					</div>
				</Panel>
				<div className="grid gap-5 xl:grid-rows-[minmax(0,1fr)_auto]">
					<Panel className="h-full">
						<PanelHeader
							title="Gợi ý nhanh"
							description="Mỗi gợi ý mở hộp thoại soạn tin nhắn để người vận hành kiểm tra trước khi gửi."
						/>
						<div className="space-y-3 p-4">
							{promptCards.map((card) => (
								<button
									type="button"
									key={card.title}
									onClick={() => onOpenComposer(card.prompt)}
									className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
								>
									<span className="flex items-center gap-2 text-[13px] font-bold text-[var(--foreground)]">
										<Sparkles size={14} className="text-[var(--accent)]" />
										{card.title}
									</span>
									<span className="mt-1 block text-[11px] leading-4 text-[var(--muted)]">
										{card.prompt}
									</span>
								</button>
							))}
						</div>
					</Panel>
					<Panel>
						<PanelHeader title="Ràng buộc" />
						<div className="space-y-3 p-4">
							<Guardrail text="Chỉ dùng LLM key được cấu hình bằng biến môi trường server-side." />
							<Guardrail text="Không nhập provider hoặc LLM key trong trình duyệt." />
							<Guardrail text="Không yêu cầu LLM tự động đăng tải hoặc nhắm mục tiêu nhân khẩu học." />
						</div>
					</Panel>
				</div>
			</div>
		</div>
	);
}

function MessageBubble({ message }: { message: ChatMessage }) {
	const assistant = message.role === "assistant";

	return (
		<div
			className={`flex gap-3 ${assistant ? "justify-start" : "justify-end"}`}
		>
			{assistant ? (
				<span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--success-soft)] text-[var(--brand)]">
					<Bot size={16} />
				</span>
			) : null}
			<div
				className={`max-w-3xl rounded-lg border p-3 ${
					assistant
						? "border-[var(--border)] bg-[var(--surface-elevated)]"
						: "border-[var(--accent)] bg-[var(--accent-soft)]"
				}`}
			>
				<p className="whitespace-pre-wrap text-[13px] leading-6 text-[var(--foreground)]">
					{message.content}
				</p>
				<p className="mt-2 text-[10px] font-semibold uppercase text-[var(--muted)]">
					{assistant ? `LLM ${message.mode ?? "live"}` : "Người vận hành"} -{" "}
					{message.id === "chat-welcome"
						? "Phiên hiện tại"
						: formatMessageTime(message.createdAt)}
				</p>
			</div>
		</div>
	);
}

function Guardrail({ text }: { text: string }) {
	return (
		<div className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
			<ShieldCheck className="mt-0.5 shrink-0 text-[var(--brand)]" size={15} />
			<p className="text-[11px] leading-5 text-[var(--muted-strong)]">{text}</p>
		</div>
	);
}

function formatMessageTime(value: string) {
	return new Intl.DateTimeFormat("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
	}).format(new Date(value));
}
