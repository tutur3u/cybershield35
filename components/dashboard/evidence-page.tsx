import { Database, Plus } from "lucide-react";

import { IntelligenceEvidenceVault } from "@/components/dashboard/intelligence-evidence-vault";
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
				icon={Database}
				title="Kho bằng chứng"
				description="Các trích dẫn đã chuẩn hóa dùng cho phân tích và phản hồi nội bộ."
				actions={
					<SecondaryButton onClick={onCreateEvidence}>
						<Plus size={14} /> Thêm bằng chứng
					</SecondaryButton>
				}
			/>
			<IntelligenceEvidenceVault />
		</div>
	);
}
