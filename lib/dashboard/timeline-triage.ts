import "server-only";

import { desc, eq } from "drizzle-orm";

import type {
	EvidenceTriageNoteView,
	EvidenceTriageView,
} from "@/components/dashboard/types";
import { adminDb } from "@/lib/db/client";
import {
	auditEvents,
	evidenceItems,
	evidenceTriage,
	evidenceTriageNotes,
	intelligenceActivityRollups,
	type EvidenceTriageStatus,
} from "@/lib/db/schema";
import { TimelineNotFoundError } from "@/lib/dashboard/timeline-shared";

type TimelineActor = { displayName: string | null; id: string };

export type TimelineTriagePatch = {
	assigneeDisplayName?: string | null;
	assigneeUserId?: string | null;
	dueAt?: Date | null;
	isPinned?: boolean;
	status?: EvidenceTriageStatus;
};

export async function getEvidenceTriageDetails(evidenceId: string): Promise<{
	notes: EvidenceTriageNoteView[];
	triage: EvidenceTriageView;
}> {
	const [evidence, triageRows, notes] = await Promise.all([
		adminDb.select({ id: evidenceItems.id }).from(evidenceItems).where(eq(evidenceItems.id, evidenceId)).limit(1),
		adminDb.select().from(evidenceTriage).where(eq(evidenceTriage.evidenceItemId, evidenceId)).limit(1),
		adminDb
			.select()
			.from(evidenceTriageNotes)
			.where(eq(evidenceTriageNotes.evidenceItemId, evidenceId))
			.orderBy(desc(evidenceTriageNotes.createdAt)),
	]);
	if (!evidence[0]) throw new TimelineNotFoundError();
	return {
		notes: notes.map((note) => ({
			authorDisplayName: note.authorDisplayName,
			authorUserId: note.authorUserId,
			body: note.body,
			createdAt: note.createdAt.toISOString(),
			id: note.id,
		})),
		triage: triageRows[0] ? mapTriage(triageRows[0]) : emptyTriage(),
	};
}

export async function updateEvidenceTriage(
	evidenceId: string,
	patch: TimelineTriagePatch,
	actor: TimelineActor,
): Promise<EvidenceTriageView> {
	const now = new Date();
	const updated = await adminDb.transaction(async (tx) => {
		const evidence = await tx
			.select({ id: evidenceItems.id, riskLevel: evidenceItems.riskLevel })
			.from(evidenceItems)
			.where(eq(evidenceItems.id, evidenceId))
			.limit(1);
		if (!evidence[0]) throw new TimelineNotFoundError();
		const [row] = await tx
			.insert(evidenceTriage)
			.values({
				assigneeDisplayName: patch.assigneeDisplayName ?? null,
				assigneeUserId: patch.assigneeUserId ?? null,
				dueAt: patch.dueAt ?? null,
				evidenceItemId: evidenceId,
				isPinned: patch.isPinned ?? false,
				status: patch.status ?? "new",
				updatedAt: now,
				updatedByDisplayName: actor.displayName,
				updatedByUserId: actor.id,
			})
			.onConflictDoUpdate({
				set: {
					...(patch.assigneeDisplayName !== undefined
						? { assigneeDisplayName: patch.assigneeDisplayName }
						: {}),
					...(patch.assigneeUserId !== undefined
						? { assigneeUserId: patch.assigneeUserId }
						: {}),
					...(patch.dueAt !== undefined ? { dueAt: patch.dueAt } : {}),
					...(patch.isPinned !== undefined ? { isPinned: patch.isPinned } : {}),
					...(patch.status !== undefined ? { status: patch.status } : {}),
					updatedAt: now,
					updatedByDisplayName: actor.displayName,
					updatedByUserId: actor.id,
				},
				target: evidenceTriage.evidenceItemId,
			})
			.returning();
		await Promise.all([
			tx.insert(auditEvents).values({
				action: "evidence_triage_updated",
				entityId: evidenceId,
				entityType: "evidence_item",
				payload: {
					actorId: actor.id,
					fields: Object.keys(patch).filter((key) => key !== "assigneeDisplayName"),
				},
			}),
			tx.insert(intelligenceActivityRollups).values({
				action: "evidence_triage_updated",
				description: `${actor.displayName ?? "Một thành viên"} đã cập nhật phân loại nội bộ.`,
				entityId: evidenceId,
				entityType: "evidence_item",
				href: `/evidence/${evidenceId}`,
				metadata: { actorId: actor.id },
				occurredAt: now,
				severity: evidence[0].riskLevel,
				title: "Cập nhật xử lý bằng chứng",
			}),
		]);
		return row;
	});
	if (!updated) throw new Error("Không thể lưu trạng thái xử lý.");
	return mapTriage(updated);
}

export async function addEvidenceTriageNote(
	evidenceId: string,
	body: string,
	actor: TimelineActor,
): Promise<EvidenceTriageNoteView> {
	const now = new Date();
	const note = await adminDb.transaction(async (tx) => {
		const evidence = await tx
			.select({ id: evidenceItems.id, riskLevel: evidenceItems.riskLevel })
			.from(evidenceItems)
			.where(eq(evidenceItems.id, evidenceId))
			.limit(1);
		if (!evidence[0]) throw new TimelineNotFoundError();
		const [created] = await tx
			.insert(evidenceTriageNotes)
			.values({
				authorDisplayName: actor.displayName,
				authorUserId: actor.id,
				body,
				createdAt: now,
				evidenceItemId: evidenceId,
			})
			.returning();
		await Promise.all([
			tx.insert(auditEvents).values({
				action: "evidence_triage_note_added",
				entityId: evidenceId,
				entityType: "evidence_item",
				payload: { actorId: actor.id, noteId: created?.id },
			}),
			tx.insert(intelligenceActivityRollups).values({
				action: "evidence_triage_note_added",
				description: `${actor.displayName ?? "Một thành viên"} đã thêm ghi chú nội bộ.`,
				entityId: evidenceId,
				entityType: "evidence_item",
				href: `/evidence/${evidenceId}`,
				metadata: { actorId: actor.id, noteId: created?.id },
				occurredAt: now,
				severity: evidence[0].riskLevel,
				title: "Ghi chú xử lý mới",
			}),
		]);
		return created;
	});
	if (!note) throw new Error("Không thể tạo ghi chú.");
	return {
		authorDisplayName: note.authorDisplayName,
		authorUserId: note.authorUserId,
		body: note.body,
		createdAt: note.createdAt.toISOString(),
		id: note.id,
	};
}


function mapTriage(row: typeof evidenceTriage.$inferSelect): EvidenceTriageView {
	return {
		assigneeDisplayName: row.assigneeDisplayName,
		assigneeUserId: row.assigneeUserId,
		dueAt: row.dueAt?.toISOString() ?? null,
		isPinned: row.isPinned,
		status: row.status,
		updatedAt: row.updatedAt.toISOString(),
		updatedByDisplayName: row.updatedByDisplayName,
	};
}

function emptyTriage(): EvidenceTriageView {
	return {
		assigneeDisplayName: null,
		assigneeUserId: null,
		dueAt: null,
		isPinned: false,
		status: "new",
		updatedAt: null,
		updatedByDisplayName: null,
	};
}
