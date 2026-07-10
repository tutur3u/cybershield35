import { MessageCircle, Send } from "lucide-react";

import { ChatWorkspace } from "@/components/dashboard/chat-workspace";
import { PageHeader } from "@/components/dashboard/page-header";

export const instant = true;

export default function ChatPage() {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={MessageCircle}
				title="Chat LLM"
				description="Trao đổi với LLM về phân tích, bằng chứng và phản hồi nội bộ."
				actions={
					<a
						href="#chat-compose"
						className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 text-[12px] font-bold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]"
					>
						<Send size={14} /> Soạn tin nhắn
					</a>
				}
			/>
			<ChatWorkspace />
		</div>
	);
}
