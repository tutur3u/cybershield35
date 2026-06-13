import { CyberShieldDashboard } from "@/components/dashboard/cybershield-dashboard";

export default async function EvidenceDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ scanId?: string }>;
}) {
	const [{ id }, { scanId }] = await Promise.all([params, searchParams]);

	return (
		<CyberShieldDashboard
			evidenceId={id}
			page="evidence-detail"
			scanId={scanId}
		/>
	);
}
