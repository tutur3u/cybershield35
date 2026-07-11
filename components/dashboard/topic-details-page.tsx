import { ArrowRight, Layers3 } from "lucide-react";
import Link from "next/link";

import { TopicDetailPanel } from "@/components/dashboard/analysis-widgets";
import { PageHeader } from "@/components/dashboard/page-header";

export function TopicDetailsPage({ topicSlug }: { topicSlug?: string }) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Layers3}
				title="Chi tiết chủ đề"
				description="Các bài viết và bằng chứng đã được hệ thống gắn với chủ đề này."
				actions={
					<Link
						href="/topics"
						className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
					>
						Danh sách chủ đề <ArrowRight size={14} />
					</Link>
				}
			/>
			<TopicDetailPanel slug={topicSlug} />
		</div>
	);
}
