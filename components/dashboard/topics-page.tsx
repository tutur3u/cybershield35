import { ArrowRight, Layers3, Sparkles } from "lucide-react";
import Link from "next/link";

import { IntelligenceTopicsWorkspace } from "@/components/dashboard/intelligence-topics-workspace";
import { PageHeader } from "@/components/dashboard/page-header";
import { SecondaryButton } from "@/components/dashboard/ui-primitives";

export function TopicsPage({ onOpenDraft }: { onOpenDraft: () => void }) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Layers3}
				title="Chủ đề"
				description="Xem các cụm nội dung như mục công việc: mức chú ý, xu hướng, bằng chứng mẫu và bước tiếp theo."
				actions={
					<>
						<Link
							href="/analysis"
							className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
						>
							Mở phân tích <ArrowRight size={14} />
						</Link>
						<SecondaryButton onClick={onOpenDraft}>
							<Sparkles size={14} /> Tạo phản hồi
						</SecondaryButton>
					</>
				}
			/>
			<IntelligenceTopicsWorkspace />
		</div>
	);
}
