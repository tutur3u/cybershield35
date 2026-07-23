import type { ScanDetail } from "@/components/dashboard/types";

export function toClientScanDetail(
	detail: ScanDetail | null | undefined,
): ScanDetail | null {
	if (!detail) return null;

	return {
		job: detail.job ? pickJob(detail.job) : undefined,
		source: detail.source
			? {
					createdAt: detail.source.createdAt,
					fileName: detail.source.fileName,
					normalizedUrl: detail.source.normalizedUrl,
					title: detail.source.title,
					type: detail.source.type,
				}
			: undefined,
		analysis: detail.analysis ?? null,
		evidence: detail.evidence?.map((item) => ({
			author: item.author,
			createdAt: item.createdAt,
			engagement: item.engagement,
			id: item.id,
			provider: item.provider,
			publishedAt: item.publishedAt,
			quote: item.quote,
			riskLevel: item.riskLevel,
			scanJobId: item.scanJobId,
			sentiment: item.sentiment,
			sourceId: item.sourceId,
			sourceLabel: item.sourceLabel,
			sourceUrl: item.sourceUrl,
			stance: item.stance,
			summary: item.summary,
		})),
		drafts: detail.drafts?.map((draft) => ({
			audience: draft.audience,
			body: draft.body,
			citations: draft.citations,
			createdAt: draft.createdAt,
			id: draft.id,
			language: draft.language,
			length: draft.length,
			operatorNotes: draft.operatorNotes,
			safetyNotes: draft.safetyNotes,
			scanJobId: draft.scanJobId,
			status: draft.status,
			tone: draft.tone,
			voice: draft.voice,
			updatedAt: draft.updatedAt,
		})),
		providerRuns: detail.providerRuns?.map((run) => ({
			completedAt: run.completedAt,
			errorMessage: run.errorMessage,
			id: run.id,
			provider: run.provider,
			startedAt: run.startedAt,
			status: run.status,
		})),
		audit: detail.audit?.map((event) => ({
			action: event.action,
			createdAt: event.createdAt,
			id: event.id,
		})),
	};
}

function pickJob(job: Record<string, unknown>) {
	return {
		completedAt: job.completedAt,
		createdAt: job.createdAt,
		errorMessage: job.errorMessage,
		id: job.id,
		provider: job.provider,
		startedAt: job.startedAt,
		status: job.status,
		updatedAt: job.updatedAt,
	};
}
