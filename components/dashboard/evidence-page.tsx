import { CalendarDays, Plus } from "lucide-react";

import { EvidenceTimeline } from "@/components/dashboard/evidence-timeline";
import { PageHeader } from "@/components/dashboard/page-header";
import { SecondaryButton } from "@/components/dashboard/ui-primitives";

export function EvidencePage({
	onCreateEvidence,
}: {
	onCreateEvidence: () => void;
}) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={CalendarDays}
				title="Dòng thời gian"
				description="Theo dõi mọi bài viết đã chuẩn hóa, phối hợp xử lý và giữ nguyên ngữ cảnh khi dữ liệu mới xuất hiện."
				actions={
					<SecondaryButton onClick={onCreateEvidence}>
						<Plus size={14} /> Thêm bằng chứng
					</SecondaryButton>
				}
			/>
			<EvidenceTimeline />
		</div>
	);
}
