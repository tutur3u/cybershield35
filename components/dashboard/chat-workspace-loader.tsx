"use client";

import dynamic from "next/dynamic";

const ChatWorkspace = dynamic(
	() => import("@/components/dashboard/chat-workspace").then((module) => module.ChatWorkspace),
	{
		loading: () => <div aria-label="Đang tải Chat" className="h-[70vh] animate-pulse rounded-xl bg-[var(--surface)]" />,
		ssr: false,
	},
);

export function ChatWorkspaceLoader({
	conversationId,
	initialPrompt,
}: {
	conversationId?: string;
	initialPrompt?: string;
}) {
	return (
		<ChatWorkspace
			conversationId={conversationId}
			initialPrompt={initialPrompt}
		/>
	);
}
