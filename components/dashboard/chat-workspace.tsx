"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { sendChatMessage } from "@/components/dashboard/client-actions";
import { ChatPage } from "@/components/dashboard/chat-page";
import { DeferredDialogLoading } from "@/components/dashboard/deferred-dialog-loading";
import type { ChatMessage } from "@/components/dashboard/types";

const ChatDialog = dynamic(
	() =>
		import("@/components/dashboard/chat-dialog").then(
			(module) => module.ChatDialog,
		),
	{
		loading: () => <DeferredDialogLoading label="Đang tải cửa sổ chat" />,
		ssr: false,
	},
);

const initialMessages: ChatMessage[] = [
	{
		id: "chat-welcome",
		role: "assistant",
		content:
			"Tôi có thể hỗ trợ phân tích rủi ro, kiểm tra bằng chứng và gợi ý phản hồi nội bộ. Nội dung chat không tự động đăng tải.",
		createdAt: "2026-01-01T00:00:00.000Z",
	},
];

export function ChatWorkspace() {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [draft, setDraft] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
	const [isSending, setIsSending] = useState(false);
	const [, setNotice] = useState("");

	function openComposer(preset = "") {
		setDraft(preset);
		setDialogOpen(true);
	}

	useEffect(() => {
		const openFromHash = () => {
			if (window.location.hash !== "#chat-compose") return;
			setDraft("");
			setDialogOpen(true);
			window.history.replaceState(
				null,
				"",
				`${window.location.pathname}${window.location.search}`,
			);
		};

		openFromHash();
		window.addEventListener("hashchange", openFromHash);
		return () => window.removeEventListener("hashchange", openFromHash);
	}, []);

	return (
		<>
			<ChatPage
				isSending={isSending}
				messages={messages}
				onOpenComposer={openComposer}
				showHeader={false}
			/>
			{dialogOpen ? (
				<ChatDialog
					open
					onClose={() => setDialogOpen(false)}
					draft={draft}
					setDraft={setDraft}
					isSending={isSending}
					onSend={(content) =>
						sendChatMessage({
							messages,
							content,
							setIsChatting: setIsSending,
							setMessages,
							setNotice,
						})
					}
				/>
			) : null}
		</>
	);
}
