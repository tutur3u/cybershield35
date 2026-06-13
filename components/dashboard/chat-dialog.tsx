"use client";

import { Send } from "lucide-react";

import { Dialog } from "@/components/dashboard/dialog-frame";
import { FieldLabel, PrimaryButton } from "@/components/dashboard/ui-primitives";

export function ChatDialog({
	draft,
	isSending,
	onClose,
	onSend,
	open,
	setDraft,
}: {
	draft: string;
	isSending: boolean;
	onClose: () => void;
	onSend: (content: string) => Promise<boolean>;
	open: boolean;
	setDraft: (value: string) => void;
}) {
	async function sendAndClose() {
		const sent = await onSend(draft);
		if (sent) {
			setDraft("");
			onClose();
		}
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Soạn tin nhắn LLM"
			description="Chat phục vụ phân tích nội bộ. Không nhập khóa bí mật, dữ liệu cá nhân nhạy cảm hoặc yêu cầu tự động đăng tải."
			size="wide"
		>
			<label className="block">
				<FieldLabel>Nội dung trao đổi</FieldLabel>
				<textarea
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					placeholder="Hỏi về phân tích, bằng chứng, rủi ro hoặc cách diễn đạt phản hồi..."
					className="mt-2 min-h-48 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-[13px] leading-6 text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
					maxLength={8000}
				/>
			</label>
			<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
				<p className="text-[11px] font-semibold text-[var(--muted)]">
					{draft.length.toLocaleString("vi-VN")} / 8.000
				</p>
				<PrimaryButton disabled={isSending || !draft.trim()} onClick={sendAndClose}>
					<Send size={15} />
					{isSending ? "Đang gửi" : "Gửi cho LLM"}
				</PrimaryButton>
			</div>
		</Dialog>
	);
}
