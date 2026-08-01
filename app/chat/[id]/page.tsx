import { Suspense } from "react";

import { ChatWorkspaceLoader } from "@/components/dashboard/chat-workspace-loader";
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
    <div className="h-[calc(100dvh-8rem)] min-h-0 overflow-hidden lg:h-[calc(100dvh-4rem)]">
      <QueryProvider>
        <Suspense
          fallback={
            <div className="h-full animate-pulse rounded-xl bg-[var(--surface)]" />
          }
        >
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
