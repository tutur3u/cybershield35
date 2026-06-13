import { CyberShieldDashboard } from "@/components/dashboard/cybershield-dashboard";

export default async function ScanDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	return <CyberShieldDashboard page="scan-detail" scanId={id} />;
}
