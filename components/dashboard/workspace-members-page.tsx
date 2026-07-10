"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@tuturuuu/ui/avatar";

import {
	AlertTriangle,
	RefreshCw,
	ShieldCheck,
	Trash2,
	UserPlus,
	UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog } from "@/components/dashboard/dialog-frame";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelHeader } from "@/components/dashboard/ui-primitives";
import type {
	WorkspaceInvitationView,
	WorkspaceMembersResponse,
	WorkspaceMemberView,
	WorkspaceMemberRole,
} from "@/components/dashboard/types";
import { workspaceMembersQueryOptions } from "@/lib/dashboard/client-queries";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";

type PendingAction =
	| { invitation: WorkspaceInvitationView; type: "remove-invitation" }
	| { member: WorkspaceMemberView; role: WorkspaceMemberRole; type: "role" }
	| { member: WorkspaceMemberView; type: "revoke" }
	| { enabled: boolean; type: "default-admin" };

const emptyPayload: WorkspaceMembersResponse = {
	context: {
		canManageMembers: false,
		canManageRoles: false,
		defaultAdminEnabled: false,
	},
	invitations: [],
	members: [],
};

export function WorkspaceMembersPage({
	initialData,
}: {
	initialData?: WorkspaceMembersResponse;
}) {
	const queryClient = useQueryClient();
	const membersQuery = useQuery({
		...workspaceMembersQueryOptions(),
		gcTime: 30 * 60_000,
		initialData,
		staleTime: 5 * 60_000,
	});
	const data = membersQuery.data ?? emptyPayload;
	const [emails, setEmails] = useState("");
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [saving, setSaving] = useState(false);
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
	const loading = membersQuery.isPending && !membersQuery.data;
	const visibleError =
		error ||
		(membersQuery.error instanceof Error ? membersQuery.error.message : "");

	const stats = useMemo(
		() => [
			{ label: "Thành viên", value: data.members.length },
			{
				label: "Admin",
				value: data.members.filter((member) => member.role === "admin").length,
			},
			{ label: "Đang mời", value: data.invitations.length },
		],
		[data],
	);

	async function loadMembers() {
		setError("");
		try {
			const result = await membersQuery.refetch();
			if (result.error) throw result.error;
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Không thể tải danh sách thành viên",
			);
		}
	}

	async function inviteMembers() {
		const normalizedEmails = parseEmails(emails);
		if (!normalizedEmails.length) {
			setError("Nhập ít nhất một email hợp lệ.");
			return;
		}

		setSaving(true);
		await mutate({
			body: { emails: normalizedEmails },
			method: "POST",
			success: "Đã gửi lời mời.",
			url: "/api/workspace/members/invitations",
		});
		setEmails("");
		setSaving(false);
	}

	async function confirmAction() {
		if (!pendingAction) return;
		setSaving(true);

		if (pendingAction.type === "remove-invitation") {
			await mutate({
				body: { email: pendingAction.invitation.email },
				method: "DELETE",
				success: "Đã gỡ lời mời.",
				url: "/api/workspace/members/access",
			});
		}

		if (pendingAction.type === "revoke") {
			await mutate({
				body: { userId: pendingAction.member.id },
				method: "DELETE",
				success: "Đã thu hồi quyền truy cập.",
				url: "/api/workspace/members/access",
			});
		}

		if (pendingAction.type === "role") {
			await mutate({
				body: {
					confirmDefaultAdminDisable:
						pendingAction.role === "member" &&
						data.context.defaultAdminEnabled,
					role: pendingAction.role,
				},
				method: "PATCH",
				success: "Đã cập nhật vai trò.",
				url: `/api/workspace/members/${encodeURIComponent(
					pendingAction.member.id,
				)}/role`,
			});
		}

		if (pendingAction.type === "default-admin") {
			await mutate({
				body: { enabled: pendingAction.enabled },
				method: "PATCH",
				success: "Đã cập nhật quyền admin mặc định.",
				url: "/api/workspace/members/default-admin",
			});
		}

		setPendingAction(null);
		setSaving(false);
	}

	async function mutate({
		body,
		method,
		success,
		url,
	}: {
		body: unknown;
		method: "DELETE" | "PATCH" | "POST";
		success: string;
		url: string;
	}) {
		setError("");
		setNotice("");
		try {
			const response = await fetch(url, {
				body: JSON.stringify(body),
				headers: { "Content-Type": "application/json" },
				method,
			});
			const payload = (await response.json().catch(() => null)) as
				| { error?: string; message?: string }
				| null;
			if (!response.ok) {
				throw new Error(errorMessage(payload, "Không thể cập nhật thành viên"));
			}
			setNotice(success);
			await queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.workspaceMembers(),
				refetchType: "active",
			});
		} catch (mutationError) {
			setError(
				mutationError instanceof Error
					? mutationError.message
					: "Không thể cập nhật thành viên",
			);
		}
	}

	return (
		<div className="space-y-5">
			<PageHeader
				icon={UsersRound}
				title="Thành viên"
				description="Mời người vận hành, thu hồi quyền truy cập và phân quyền admin cho workspace."
				actions={
					<button
						type="button"
						onClick={() => void loadMembers()}
						className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
					>
						<RefreshCw size={14} /> Làm mới
					</button>
				}
			/>

			<div className="grid gap-3 sm:grid-cols-3">
				{stats.map((stat) => (
					<Panel key={stat.label}>
						<div className="p-4">
							<p className="text-[26px] font-bold text-[var(--foreground)]">
								{stat.value.toLocaleString("vi-VN")}
							</p>
							<p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">
								{stat.label}
							</p>
						</div>
					</Panel>
				))}
			</div>

			{visibleError ? <AlertMessage tone="danger" message={visibleError} /> : null}
			{notice ? <AlertMessage tone="success" message={notice} /> : null}

			<Panel>
				<PanelHeader
					title="Mời thành viên"
					description="Nhập email, cách nhau bằng dấu phẩy hoặc xuống dòng."
				/>
				<div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
					<textarea
						value={emails}
						onChange={(event) => setEmails(event.target.value)}
						disabled={!data.context.canManageMembers || saving}
						placeholder="name@example.com, teammate@example.com"
						className="min-h-24 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-[13px] font-semibold text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] disabled:opacity-60"
					/>
					<button
						type="button"
						disabled={!data.context.canManageMembers || saving}
						onClick={() => void inviteMembers()}
						className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
					>
						<UserPlus size={14} /> Gửi lời mời
					</button>
				</div>
			</Panel>

			<Panel>
				<PanelHeader
					title="Quyền admin mặc định"
					description="Bật để mọi thành viên hiện tại và tương lai có quyền quản lý thành viên và vai trò."
				/>
				<div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="min-w-0">
						<p className="text-[13px] font-bold text-[var(--foreground)]">
							Admin cho mọi thành viên
						</p>
						<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
							Tắt lựa chọn này có thể làm một số thành viên mất quyền admin.
						</p>
					</div>
					<button
						type="button"
						disabled={!data.context.canManageRoles || saving}
						onClick={() =>
							setPendingAction({
								enabled: !data.context.defaultAdminEnabled,
								type: "default-admin",
							})
						}
						className={`inline-flex h-10 min-w-28 items-center justify-center rounded-md px-3 text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
							data.context.defaultAdminEnabled
								? "bg-[var(--success-soft)] text-[var(--success-strong)]"
								: "border border-[var(--border)] text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
						}`}
					>
						{data.context.defaultAdminEnabled ? "Đang bật" : "Đang tắt"}
					</button>
				</div>
			</Panel>

			<Panel>
				<PanelHeader
					title="Danh sách truy cập"
					description="Thành viên đang hoạt động và lời mời đang chờ."
				/>
				{loading ? (
					<MemberListSkeleton />
				) : (
					<MemberList
						context={data.context}
						invitations={data.invitations}
						members={data.members}
						onAction={setPendingAction}
						saving={saving}
					/>
				)}
			</Panel>

			<ConfirmDialog
				action={pendingAction}
				defaultAdminEnabled={data.context.defaultAdminEnabled}
				onClose={() => setPendingAction(null)}
				onConfirm={() => void confirmAction()}
				saving={saving}
			/>
		</div>
	);
}

function MemberListSkeleton() {
	return (
		<div className="animate-pulse divide-y divide-[var(--divider)]">
			{Array.from({ length: 4 }, (_, index) => (
				<div
					key={index}
					className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_140px_220px] lg:items-center"
				>
					<div className="flex min-w-0 items-center gap-3">
						<div className="size-10 rounded-md bg-[var(--surface-soft)]" />
						<div className="min-w-0 space-y-2">
							<div className="h-4 w-44 rounded-md bg-[var(--surface-soft)]" />
							<div className="h-3 w-32 rounded-md bg-[var(--surface-soft)]" />
						</div>
					</div>
					<div className="h-7 w-20 rounded-md bg-[var(--surface-soft)]" />
					<div className="flex gap-2 lg:justify-end">
						<div className="h-9 w-20 rounded-md bg-[var(--surface-soft)]" />
						<div className="h-9 w-24 rounded-md bg-[var(--surface-soft)]" />
					</div>
				</div>
			))}
		</div>
	);
}

function MemberList({
	context,
	invitations,
	members,
	onAction,
	saving,
}: {
	context: WorkspaceMembersResponse["context"];
	invitations: WorkspaceInvitationView[];
	members: WorkspaceMemberView[];
	onAction: (action: PendingAction) => void;
	saving: boolean;
}) {
	if (!members.length && !invitations.length) {
		return (
			<div className="grid place-items-center px-4 py-12 text-center">
				<UsersRound className="text-[var(--muted)]" size={28} />
				<p className="mt-3 text-[13px] font-bold text-[var(--foreground)]">
					Chưa có thành viên
				</p>
				<p className="mt-1 text-[12px] text-[var(--muted)]">
					Mời người vận hành để bắt đầu phân quyền.
				</p>
			</div>
		);
	}

	return (
		<div className="divide-y divide-[var(--divider)]">
			{members.map((member) => (
				<div
					key={member.id}
					className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_140px_220px] lg:items-center"
				>
					<MemberIdentity member={member} />
					<RoleBadge member={member} />
					<div className="flex flex-wrap gap-2 lg:justify-end">
						<button
							type="button"
							disabled={
								saving ||
								!context.canManageRoles ||
								member.isCreator ||
								member.isCurrentUser ||
								member.role === "admin"
							}
							onClick={() => onAction({ member, role: "admin", type: "role" })}
							className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 text-[11px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-45"
						>
							<ShieldCheck size={13} /> Admin
						</button>
						<button
							type="button"
							disabled={
								saving ||
								!context.canManageRoles ||
								member.isCreator ||
								member.isCurrentUser ||
								member.role === "member"
							}
							onClick={() => onAction({ member, role: "member", type: "role" })}
							className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--border)] px-3 text-[11px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-45"
						>
							Member
						</button>
						<button
							type="button"
							disabled={
								saving ||
								!context.canManageMembers ||
								member.isCreator ||
								member.isCurrentUser
							}
							onClick={() => onAction({ member, type: "revoke" })}
							className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--danger-border)] px-3 text-[11px] font-bold text-[var(--danger-strong)] transition hover:bg-[var(--danger-soft)] disabled:cursor-not-allowed disabled:opacity-45"
						>
							<Trash2 size={13} /> Thu hồi
						</button>
					</div>
				</div>
			))}
			{invitations.map((invitation) => (
				<div
					key={invitation.email}
					className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_140px_220px] lg:items-center"
				>
					<div className="min-w-0">
						<p className="truncate text-[13px] font-bold text-[var(--foreground)]">
							{invitation.email}
						</p>
						<p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">
							Đang chờ chấp nhận
						</p>
					</div>
					<span className="inline-flex h-7 w-fit items-center rounded-md bg-[var(--warning-soft)] px-2.5 text-[11px] font-bold text-[var(--warning-strong)]">
						Lời mời
					</span>
					<div className="flex justify-start lg:justify-end">
						<button
							type="button"
							disabled={saving || !context.canManageMembers}
							onClick={() =>
								onAction({ invitation, type: "remove-invitation" })
							}
							className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--danger-border)] px-3 text-[11px] font-bold text-[var(--danger-strong)] transition hover:bg-[var(--danger-soft)] disabled:cursor-not-allowed disabled:opacity-45"
						>
							<Trash2 size={13} /> Gỡ lời mời
						</button>
					</div>
				</div>
			))}
		</div>
	);
}

function MemberIdentity({ member }: { member: WorkspaceMemberView }) {
	return (
		<div className="flex min-w-0 items-center gap-3">
			<Avatar className="size-10 rounded-md border border-[var(--border)] bg-[var(--surface-soft)]">
				{member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
				<AvatarFallback className="rounded-md bg-[var(--surface-soft)] text-[13px] font-bold text-[var(--muted-strong)]">
					{initials(member)}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0">
				<p className="truncate text-[13px] font-bold text-[var(--foreground)]">
					{member.displayName || member.email || "Thành viên"}
				</p>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{member.email ?? member.id}
					{member.isCurrentUser ? " - Bạn" : ""}
				</p>
			</div>
		</div>
	);
}

function RoleBadge({ member }: { member: WorkspaceMemberView }) {
	return (
		<div className="flex flex-wrap gap-2">
			<span
				className={`inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-bold ${
					member.role === "admin"
						? "bg-[var(--success-soft)] text-[var(--success-strong)]"
						: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]"
				}`}
			>
				{member.role === "admin" ? "Admin" : "Member"}
			</span>
			{member.isCreator ? (
				<span className="inline-flex h-7 items-center rounded-md bg-[var(--accent-soft)] px-2.5 text-[11px] font-bold text-[var(--accent-strong)]">
					Chủ sở hữu
				</span>
			) : null}
		</div>
	);
}

function ConfirmDialog({
	action,
	defaultAdminEnabled,
	onClose,
	onConfirm,
	saving,
}: {
	action: PendingAction | null;
	defaultAdminEnabled: boolean;
	onClose: () => void;
	onConfirm: () => void;
	saving: boolean;
}) {
	if (!action) return null;

	const content = confirmationContent(action, defaultAdminEnabled);

	return (
		<Dialog
			open
			onClose={onClose}
			title={content.title}
			description={content.description}
		>
			<div className="space-y-4">
				{content.warning ? (
					<div className="flex gap-3 rounded-md border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-[12px] font-semibold leading-5 text-[var(--warning-strong)]">
						<AlertTriangle size={16} className="mt-0.5 shrink-0" />
						<span>{content.warning}</span>
					</div>
				) : null}
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="h-10 rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
					>
						Hủy
					</button>
					<button
						type="button"
						disabled={saving}
						onClick={onConfirm}
						className="h-10 rounded-md bg-[var(--danger)] px-3 text-[12px] font-bold text-white transition hover:bg-[var(--danger-strong)] disabled:opacity-60"
					>
						Xác nhận
					</button>
				</div>
			</div>
		</Dialog>
	);
}

function AlertMessage({
	message,
	tone,
}: {
	message: string;
	tone: "danger" | "success";
}) {
	return (
		<div
			className={`rounded-md border px-4 py-3 text-[12px] font-bold ${
				tone === "danger"
					? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-strong)]"
					: "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]"
			}`}
		>
			{message}
		</div>
	);
}

function confirmationContent(
	action: PendingAction,
	defaultAdminEnabled: boolean,
) {
	if (action.type === "remove-invitation") {
		return {
			description: action.invitation.email,
			title: "Gỡ lời mời đang chờ?",
		};
	}
	if (action.type === "revoke") {
		return {
			description: action.member.email ?? action.member.displayName ?? action.member.id,
			title: "Thu hồi quyền truy cập?",
			warning: "Người này sẽ không thể mở workspace trong ứng dụng.",
		};
	}
	if (action.type === "role") {
		return {
			description: action.member.email ?? action.member.displayName ?? action.member.id,
			title:
				action.role === "admin"
					? "Cấp quyền admin?"
					: "Chuyển về member?",
			warning:
				action.role === "member" && defaultAdminEnabled
					? "Quyền admin mặc định đang bật, thao tác này cũng sẽ tắt admin mặc định cho mọi thành viên."
					: undefined,
		};
	}
	return {
		description: action.enabled
			? "Mọi thành viên sẽ có quyền quản lý thành viên và vai trò."
			: "Chỉ các thành viên có role admin riêng mới giữ quyền admin.",
		title: action.enabled
			? "Bật admin mặc định?"
			: "Tắt admin mặc định?",
		warning: action.enabled
			? undefined
			: "Hãy đảm bảo vẫn còn ít nhất một admin trước khi tắt.",
	};
}

function parseEmails(value: string) {
	return [
		...new Set(
			value
				.split(/[,\n;]/u)
				.map((email) => email.trim().toLowerCase())
				.filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)),
		),
	];
}

function errorMessage(
	value: { error?: string; message?: string } | null,
	fallback: string,
) {
	return value?.error || value?.message || fallback;
}

function initials(member: WorkspaceMemberView) {
	const source = member.displayName || member.email || member.id;
	return source
		.split(/\s|@/u)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}
