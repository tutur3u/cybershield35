import { MessageCircle } from "lucide-react";
import { Suspense } from "react";

import { ChatWorkspaceLoader } from "@/components/dashboard/chat-workspace-loader";
import { PageHeader } from "@/components/dashboard/page-header";
import { QueryProvider } from "@/components/providers/query-provider";

export const instant = true;
export const prefetch = "allow-runtime";

export default function ChatConversationPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ prompt?: string }>;
}) {
	return (
		<div className="space-y-5">
			<PageHeader
				description="Chat riêng tư hoặc được chia sẻ trong workspace; mọi thay đổi đều cần xác nhận."
				icon={MessageCircle}
				title="Chat"
			/>
			<QueryProvider>
				<Suspense fallback={<div className="h-[70vh] animate-pulse rounded-xl bg-[var(--surface)]" />}>
					<ConversationRoute params={params} searchParams={searchParams} />
				</Suspense>
			</QueryProvider>
		</div>
	);
}

async function ConversationRoute({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ prompt?: string }>;
}) {
	const [{ id }, { prompt }] = await Promise.all([params, searchParams]);
	return <ChatWorkspaceLoader conversationId={id} initialPrompt={prompt} />;
}
