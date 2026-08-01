import { ChatWorkspaceLoader } from "@/components/dashboard/chat-workspace-loader";
import { QueryProvider } from "@/components/providers/query-provider";

export const instant = true;

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { prompt } = await searchParams;
  return (
    <div className="h-[calc(100dvh-8rem)] min-h-0 overflow-hidden lg:h-[calc(100dvh-4rem)]">
      <QueryProvider>
        <ChatWorkspaceLoader initialPrompt={prompt} />
      </QueryProvider>
    </div>
  );
}
