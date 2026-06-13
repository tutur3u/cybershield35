import { CyberShieldDashboard } from "@/components/dashboard/cybershield-dashboard";

export default async function DraftDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ scanId?: string }>;
}) {
	const [{ id }, { scanId }] = await Promise.all([params, searchParams]);

	return <CyberShieldDashboard draftId={id} page="draft-detail" scanId={scanId} />;
}
