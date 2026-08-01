"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@tuturuuu/ui/sheet";
import { CalendarClock, ExternalLink, Pin, Send, UserRound } from "lucide-react";
import { useState } from "react";

import type {
	EvidenceTriageNoteView,
	EvidenceTriageView,
	TimelinePost,
} from "@/components/dashboard/types";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { workspaceMembersQueryOptions } from "@/lib/dashboard/client-queries";

type TriageDetails = { notes: EvidenceTriageNoteView[]; triage: EvidenceTriageView };
type TriagePatch = Partial<Pick<EvidenceTriageView, "assigneeUserId" | "dueAt" | "isPinned" | "status">>;

export default function EvidenceTriageSheet({
	onOpenChange,
	onOptimisticUpdate,
	open,
	post,
}: {
	onOpenChange: (open: boolean) => void;
	onOptimisticUpdate: (patch: TriagePatch) => () => void;
	open: boolean;
	post: TimelinePost;
}) {
	const queryClient = useQueryClient();
	const [assignmentOpen, setAssignmentOpen] = useState(false);
	const [noteBody, setNoteBody] = useState("");
	const detailsQuery = useQuery({
		initialData: { notes: [], triage: post.triage },
		queryFn: () => fetchTriageDetails(post.id),
		queryKey: dashboardQueryKeys.timelineTriage(post.id),
		staleTime: 30_000,
	});
	const membersQuery = useQuery({
		...workspaceMembersQueryOptions(),
		enabled: assignmentOpen,
	});
	const patchMutation = useMutation<
		{ triage: EvidenceTriageView },
		Error,
		TriagePatch,
		() => void
	>({
		mutationFn: (patch: TriagePatch) => patchTriage(post.id, patch),
		onError: (_error, _patch, rollback) => rollback?.(),
		onMutate: (patch) => {
			const key = dashboardQueryKeys.timelineTriage(post.id);
			const previousDetails = queryClient.getQueryData<TriageDetails>(key);
			const rollbackTimeline = onOptimisticUpdate(patch);
			queryClient.setQueryData<TriageDetails>(key, (previous) => ({
				notes: previous?.notes ?? [],
				triage: {
					...(previous?.triage ?? post.triage),
					...patch,
					updatedAt: new Date().toISOString(),
				},
			}));
			return () => {
				rollbackTimeline();
				queryClient.setQueryData(key, previousDetails);
			};
		},
		onSuccess: ({ triage }) => {
			queryClient.setQueryData<TriageDetails>(
				dashboardQueryKeys.timelineTriage(post.id),
				(previous) => ({ notes: previous?.notes ?? [], triage }),
			);
			void queryClient.invalidateQueries({ queryKey: ["dashboard", "timeline"] });
		},
	});
	const noteMutation = useMutation({
		mutationFn: (body: string) => addNote(post.id, body),
		onSuccess: ({ note }) => {
			setNoteBody("");
			queryClient.setQueryData<TriageDetails>(
				dashboardQueryKeys.timelineTriage(post.id),
				(previous) => ({
					notes: [note, ...(previous?.notes ?? [])],
					triage: previous?.triage ?? post.triage,
				}),
			);
			void queryClient.invalidateQueries({ queryKey: ["dashboard", "timeline", "head"] });
		},
	});
	const triage = detailsQuery.data.triage;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full bg-[var(--surface)] sm:max-w-xl" aria-describedby="triage-description">
				<SheetHeader className="border-b border-[var(--border)] pr-12">
					<SheetTitle className="text-[var(--foreground)]">Xử lý nội bộ</SheetTitle>
					<SheetDescription id="triage-description">
						Phân công, đặt hạn, ghim cho đội ngũ và lưu ghi chú bất biến.
					</SheetDescription>
				</SheetHeader>
				<div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-8">
					<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
						<p className="line-clamp-3 text-sm font-bold text-[var(--foreground)]">{post.quote}</p>
						<div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
							<a href={post.href} className="inline-flex items-center gap-1 text-[var(--accent-strong)]">Bằng chứng <ExternalLink size={12} /></a>
							<a href={post.scanHref} className="inline-flex items-center gap-1 text-[var(--accent-strong)]">Scan liên quan <ExternalLink size={12} /></a>
							{post.originalPostHref ? <a href={post.originalPostHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--accent-strong)]">Bài gốc <ExternalLink size={12} /></a> : null}
						</div>
					</div>

					<Field label="Trạng thái">
						<select
							aria-label="Trạng thái xử lý"
							value={triage.status}
							onChange={(event) => patchMutation.mutate({ status: event.target.value as EvidenceTriageView["status"] })}
							className={inputClass}
						>
							<option value="new">Mới</option>
							<option value="reviewing">Đang xem xét</option>
							<option value="action_required">Cần hành động</option>
							<option value="resolved">Đã giải quyết</option>
							<option value="dismissed">Bỏ qua</option>
						</select>
					</Field>

					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Hạn xử lý" icon={CalendarClock}>
							<input
								type="date"
								value={triage.dueAt?.slice(0, 10) ?? ""}
								onChange={(event) => patchMutation.mutate({ dueAt: event.target.value ? `${event.target.value}T00:00:00+07:00` : null })}
								className={inputClass}
							/>
						</Field>
						<Field label="Ghim đội ngũ" icon={Pin}>
							<button
								type="button"
								aria-pressed={triage.isPinned}
								onClick={() => patchMutation.mutate({ isPinned: !triage.isPinned })}
								className={`${inputClass} flex items-center justify-between ${triage.isPinned ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : ""}`}
							>
								{triage.isPinned ? "Đã ghim" : "Chưa ghim"}<Pin size={15} fill={triage.isPinned ? "currentColor" : "none"} />
							</button>
						</Field>
					</div>

					<Field label="Người phụ trách" icon={UserRound}>
						{assignmentOpen ? (
							<select
								aria-label="Người phụ trách"
								value={triage.assigneeUserId ?? ""}
								disabled={membersQuery.isPending || membersQuery.isError}
								onChange={(event) => patchMutation.mutate({ assigneeUserId: event.target.value || null })}
								className={inputClass}
							>
								<option value="">Chưa phân công</option>
								{membersQuery.data?.members.map((member) => <option key={member.id} value={member.id}>{member.displayName ?? member.email ?? member.id}</option>)}
							</select>
						) : (
							<button type="button" onClick={() => setAssignmentOpen(true)} className={`${inputClass} text-left`}>
								{triage.assigneeDisplayName ?? "Chọn thành viên CyberShield35"}
							</button>
						)}
						{membersQuery.isError ? <p className="mt-2 text-xs font-semibold text-[var(--danger-strong)]">Không thể tải danh bạ. Các cập nhật khác vẫn khả dụng.</p> : null}
					</Field>

					<section className="space-y-3 border-t border-[var(--border)] pt-5">
						<div>
							<h3 className="text-sm font-bold text-[var(--foreground)]">Ghi chú nội bộ</h3>
							<p className="mt-1 text-xs text-[var(--muted)]">Ghi chú chỉ được thêm mới, không thể sửa hoặc xóa.</p>
						</div>
						<form
							onSubmit={(event) => {
								event.preventDefault();
								const body = noteBody.trim();
								if (body) noteMutation.mutate(body);
							}}
							className="space-y-2"
						>
							<textarea
								aria-label="Nội dung ghi chú"
								maxLength={4000}
								rows={3}
								value={noteBody}
								onChange={(event) => setNoteBody(event.target.value)}
								placeholder="Thêm nhận định hoặc bước tiếp theo…"
								className={`${inputClass} h-auto py-2`}
							/>
							<div className="flex items-center justify-between gap-3">
								<span className="text-[11px] text-[var(--muted)]">{noteBody.length}/4000</span>
								<button type="submit" disabled={!noteBody.trim() || noteMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-3 text-xs font-bold text-white disabled:opacity-50"><Send size={14} /> Thêm ghi chú</button>
							</div>
						</form>
						{detailsQuery.isPending ? <p className="text-xs text-[var(--muted)]">Đang tải ghi chú…</p> : null}
						<div className="space-y-2">
							{detailsQuery.data.notes.map((note) => (
								<article key={note.id} className="rounded-lg border border-[var(--border)] p-3">
									<div className="flex flex-wrap justify-between gap-2 text-[11px] font-semibold text-[var(--muted)]"><span>{note.authorDisplayName ?? note.authorUserId}</span><time>{formatDate(note.createdAt)}</time></div>
									<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">{note.body}</p>
								</article>
							))}
						</div>
					</section>
					{patchMutation.isError ? <p role="alert" className="text-xs font-semibold text-[var(--danger-strong)]">{patchMutation.error.message}</p> : null}
				</div>
			</SheetContent>
		</Sheet>
	);
}

function Field({ children, icon: Icon, label }: { children: React.ReactNode; icon?: typeof Pin; label: string }) {
	return <label className="block space-y-2"><span className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted-strong)]">{Icon ? <Icon size={14} /> : null}{label}</span>{children}</label>;
}

const inputClass = "h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]";

async function fetchTriageDetails(id: string): Promise<TriageDetails> {
	return fetchJson(`/api/evidence/${encodeURIComponent(id)}/triage`);
}

async function patchTriage(id: string, patch: TriagePatch): Promise<{ triage: EvidenceTriageView }> {
	return fetchJson(`/api/evidence/${encodeURIComponent(id)}/triage`, { body: JSON.stringify(patch), method: "PATCH" });
}

async function addNote(id: string, body: string): Promise<{ note: EvidenceTriageNoteView }> {
	return fetchJson(`/api/evidence/${encodeURIComponent(id)}/triage/notes`, { body: JSON.stringify({ body }), method: "POST" });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, { ...init, credentials: "same-origin", headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) } });
	const payload = await response.json().catch(() => null);
	if (!response.ok) throw new Error(payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Không thể lưu thay đổi.");
	return payload as T;
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}
