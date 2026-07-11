import { MessageCircle } from "lucide-react";

import { ChatWorkspaceLoader } from "@/components/dashboard/chat-workspace-loader";
import { PageHeader } from "@/components/dashboard/page-header";
import { QueryProvider } from "@/components/providers/query-provider";

export const instant = true;

export default function ChatPage() {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={MessageCircle}
				title="Chat"
				description="Không gian phân tích, công cụ nội bộ, tệp Tuturuuu Drive và bản nháp cần duyệt."
			/>
			<QueryProvider>
				<ChatWorkspaceLoader />
			</QueryProvider>
		</div>
	);
}
