import "server-only";

import type { EvidenceTriageStatus } from "@/lib/db/schema";
import type { TimelinePost } from "@/components/dashboard/types";

import { facebookUsername } from "@/lib/dashboard/timeline-shared";

export function mapTimelinePost(
	row: {
		collectedMicros: number;
		engagementTotal: number;
		id: string;
		publishedMicros: number;
		riskScore: number;
		triageUpdatedMicros: number;
		author: string | null;
		comments: number;
		createdAt: Date;
		facebookPageId: string | null;
		pageClassification: TimelinePost["pageClassification"];
		originalImageUrl: string | null;
		provider: TimelinePost["provider"];
		publishedAt: Date | null;
		quote: string;
		reactions: number;
		riskLevel: TimelinePost["riskLevel"];
		scanJobId: string;
		sentiment: string;
		shares: number;
		sourceLabel: string | null;
		sourceUrl: string | null;
		stance: string;
		summary: string;
		triageAssigneeDisplayName: string | null;
		triageAssigneeUserId: string | null;
		triageDueAt: Date | null;
		triageIsPinned: boolean | null;
		triageStatus: EvidenceTriageStatus;
		triageUpdatedAt: Date | null;
		triageUpdatedByDisplayName: string | null;
	},
	topicSlugs: string[],
): TimelinePost {
	return {
		author: row.author,
		createdAt: row.createdAt.toISOString(),
		engagement: {
			comments: Number(row.comments),
			reactions: Number(row.reactions),
			shares: Number(row.shares),
			total: Number(row.engagementTotal),
		},
		facebookPageId: row.facebookPageId,
		facebookUsername: facebookUsername(row.author, row.sourceUrl),
		href: `/evidence/${row.id}`,
		id: row.id,
		originalPostHref: row.sourceUrl,
		originalImageUrl: row.originalImageUrl,
		pageClassification: row.pageClassification,
		provider: row.provider,
		publishedAt: row.publishedAt?.toISOString() ?? null,
		quote: row.quote,
		riskLevel: row.riskLevel,
		scanHref: `/scans/${row.scanJobId}`,
		scanId: row.scanJobId,
		sentiment: row.sentiment,
		sourceLabel: row.sourceLabel,
		sourceUrl: row.sourceUrl,
		stance: row.stance,
		summary: row.summary,
		topicSlugs,
		triage: {
			assigneeDisplayName: row.triageAssigneeDisplayName,
			assigneeUserId: row.triageAssigneeUserId,
			dueAt: row.triageDueAt?.toISOString() ?? null,
			isPinned: row.triageIsPinned ?? false,
			status: row.triageStatus,
			updatedAt: row.triageUpdatedAt?.toISOString() ?? null,
			updatedByDisplayName: row.triageUpdatedByDisplayName,
		},
	};
}
