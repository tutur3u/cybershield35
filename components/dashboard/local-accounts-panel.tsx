"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Copy,
	KeyRound,
	Lock,
	LogOut,
	RefreshCw,
	ShieldCheck,
	Trash2,
	UserPlus,
} from "lucide-react";
import { useState } from "react";

import { Dialog } from "@/components/dashboard/dialog-frame";
import { Panel, PanelHeader } from "@/components/dashboard/ui-primitives";
import type {
	LocalAccountRoleView,
	LocalAccountView,
	LocalAccountsResponse,
} from "@/components/dashboard/types";
import { localAccountsQueryOptions } from "@/lib/dashboard/client-queries";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";

type PendingAction =
	| { account: LocalAccountView; type: "delete" }
	| { account: LocalAccountView; type: "reset-password" }
	| { account: LocalAccountView; type: "revoke-sessions" }
	| { account: LocalAccountView; role: LocalAccountRoleView; type: "role" }
	| { account: LocalAccountView; disabled: boolean; type: "disabled" };

type IssuedCredential = { password: string; username: string };

const emptyPayload: LocalAccountsResponse = {
	accounts: [],
	context: { canManage: false },
};

export function LocalAccountsPanel({
	initialData,
}: {
	initialData?: LocalAccountsResponse;
}) {
	const queryClient = useQueryClient();
	const accountsQuery = useQuery({
		...localAccountsQueryOptions(),
		initialData,
	});
	const data = accountsQuery.data ?? emptyPayload;
	const canManage = data.context.canManage;

	const [username, setUsername] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [role, setRole] = useState<LocalAccountRoleView>("member");
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [issued, setIssued] = useState<IssuedCredential | null>(null);
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

	const mutation = useMutation({
		mutationFn: async (input: {
			body?: unknown;
			method: "DELETE" | "PATCH" | "POST";
			url: string;
		}) => {
			const response = await fetch(input.url, {
				body: input.body === undefined ? undefined : JSON.stringify(input.body),
				headers:
					input.body === undefined
						? undefined
						: { "Content-Type": "application/json" },
				method: input.method,
			});
			const payload = (await response.json().catch(() => null)) as
				| { error?: string; password?: string; account?: LocalAccountView }
				| null;
			if (!response.ok) {
				throw new Error(payload?.error || "Không thể cập nhật tài khoản.");
			}
			return payload;
		},
		onError: (mutationError: Error) => {
			setNotice("");
			setError(mutationError.message);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.localAccounts(),
				refetchType: "active",
			});
		},
	});

	const saving = mutation.isPending;
	const visibleError =
		error ||
		(accountsQuery.error instanceof Error ? accountsQuery.error.message : "");

	async function createAccount() {
		setError("");
		setNotice("");
		const payload = await mutation
			.mutateAsync({
				body: {
					displayName: displayName.trim() || undefined,
					role,
					username: username.trim().toLowerCase(),
				},
				method: "POST",
				url: "/api/admin/local-accounts",
			})
			.catch(() => null);
		if (!payload?.password) return;

		setIssued({ password: payload.password, username: payload.account?.username ?? username });
		setUsername("");
		setDisplayName("");
		setRole("member");
		setNotice("Đã tạo tài khoản. Sao chép mật khẩu và gửi cho người dùng.");
	}

	async function confirmAction() {
		if (!pendingAction) return;
		setError("");
		setNotice("");
		const account = pendingAction.account;
		const base = `/api/admin/local-accounts/${encodeURIComponent(account.id)}`;

		if (pendingAction.type === "reset-password") {
			const payload = await mutation
				.mutateAsync({ body: {}, method: "POST", url: `${base}/password` })
				.catch(() => null);
			setPendingAction(null);
			if (!payload?.password) return;
			setIssued({ password: payload.password, username: account.username });
			setNotice("Đã đặt lại mật khẩu. Mật khẩu cũ và mọi phiên đăng nhập đã bị thu hồi.");
			return;
		}

		const request =
			pendingAction.type === "delete"
				? { method: "DELETE" as const, url: base }
				: pendingAction.type === "revoke-sessions"
					? { method: "DELETE" as const, url: `${base}/sessions` }
					: pendingAction.type === "role"
						? {
								body: { role: pendingAction.role },
								method: "PATCH" as const,
								url: base,
							}
						: {
								body: { disabled: pendingAction.disabled },
								method: "PATCH" as const,
								url: base,
							};

		const result = await mutation.mutateAsync(request).catch(() => null);
		setPendingAction(null);
		if (!result) return;
		setNotice(successMessage(pendingAction));
	}

	return (
		<Panel>
			<PanelHeader
				title="Tài khoản mật khẩu"
				description="Cấp tài khoản tên đăng nhập và mật khẩu cho người vận hành không dùng Tuturuuu."
				action={
					<button
						type="button"
						onClick={() => void accountsQuery.refetch()}
						className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[11px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
					>
						<RefreshCw size={13} /> Làm mới
					</button>
				}
			/>

			{!canManage ? (
				<div className="p-4">
					<div className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-soft)] p-3">
						<Lock className="mt-0.5 shrink-0 text-[var(--muted)]" size={16} />
						<div className="min-w-0">
							<p className="text-[12px] font-bold text-[var(--foreground)]">
								Không có quyền quản lý
							</p>
							<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
								{data.context.reason ??
									"Chỉ quản trị viên workspace mới cấp và quản lý được tài khoản mật khẩu."}
							</p>
						</div>
					</div>
				</div>
			) : (
				<div className="space-y-4 p-4">
					{visibleError ? <Banner tone="danger" message={visibleError} /> : null}
					{notice ? <Banner tone="success" message={notice} /> : null}
					{issued ? (
						<IssuedPasswordCard
							credential={issued}
							onDismiss={() => setIssued(null)}
						/>
					) : null}

					<div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_auto] lg:items-end">
						<Field label="Tên đăng nhập">
							<input
								autoCapitalize="none"
								autoComplete="off"
								className={inputClass}
								disabled={saving}
								onChange={(event) => setUsername(event.target.value)}
								placeholder="canbo.truyenthong"
								spellCheck={false}
								value={username}
							/>
						</Field>
						<Field label="Tên hiển thị">
							<input
								autoComplete="off"
								className={inputClass}
								disabled={saving}
								onChange={(event) => setDisplayName(event.target.value)}
								placeholder="Nguyễn Văn A"
								value={displayName}
							/>
						</Field>
						<Field label="Vai trò">
							<select
								className={inputClass}
								disabled={saving}
								onChange={(event) =>
									setRole(event.target.value as LocalAccountRoleView)
								}
								value={role}
							>
								<option value="member">Member</option>
								<option value="admin">Admin</option>
							</select>
						</Field>
						<button
							type="button"
							disabled={saving || !username.trim()}
							onClick={() => void createAccount()}
							className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent-fill)] px-4 text-[12px] font-bold text-white transition hover:bg-[var(--accent-fill-hover)] disabled:cursor-not-allowed disabled:opacity-60"
						>
							<UserPlus size={14} /> Cấp tài khoản
						</button>
					</div>

					<p className="text-[11px] leading-4 text-[var(--muted)]">
						Mật khẩu được sinh tự động và chỉ hiển thị một lần ngay sau khi cấp.
						Người dùng sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.
					</p>

					<AccountList
						accounts={data.accounts}
						onAction={setPendingAction}
						saving={saving}
					/>
				</div>
			)}

			<ConfirmDialog
				action={pendingAction}
				onClose={() => setPendingAction(null)}
				onConfirm={() => void confirmAction()}
				saving={saving}
			/>
		</Panel>
	);
}

const inputClass =
	"h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[13px] font-semibold text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] disabled:opacity-60";

function Field({
	children,
	label,
}: {
	children: React.ReactNode;
	label: string;
}) {
	return (
		<label className="block min-w-0">
			<span className="mb-1.5 block text-[11px] font-bold text-[var(--muted-strong)]">
				{label}
			</span>
			{children}
		</label>
	);
}

function AccountList({
	accounts,
	onAction,
	saving,
}: {
	accounts: LocalAccountView[];
	onAction: (action: PendingAction) => void;
	saving: boolean;
}) {
	if (!accounts.length) {
		return (
			<div className="grid place-items-center rounded-md border border-dashed border-[var(--border)] px-4 py-10 text-center">
				<KeyRound className="text-[var(--muted)]" size={24} />
				<p className="mt-3 text-[13px] font-bold text-[var(--foreground)]">
					Chưa có tài khoản mật khẩu
				</p>
				<p className="mt-1 text-[12px] text-[var(--muted)]">
					Cấp tài khoản cho người vận hành chưa có tài khoản Tuturuuu.
				</p>
			</div>
		);
	}

	return (
		<div className="divide-y divide-[var(--divider)] rounded-md border border-[var(--border)]">
			{accounts.map((account) => (
				<div
					key={account.id}
					className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto] lg:items-center"
				>
					<div className="min-w-0">
						<p className="truncate text-[13px] font-bold text-[var(--foreground)]">
							{account.displayName || account.username}
						</p>
						<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
							{account.username}
							{account.createdByDisplayName
								? ` - cấp bởi ${account.createdByDisplayName}`
								: ""}
						</p>
					</div>
					<div className="flex flex-wrap gap-1.5">
						<Badge
							tone={account.role === "admin" ? "success" : "neutral"}
							label={account.role === "admin" ? "Admin" : "Member"}
						/>
						{account.disabled ? <Badge tone="danger" label="Đã tắt" /> : null}
						{account.lockedUntil ? <Badge tone="warning" label="Đang khóa" /> : null}
						{account.mustChangePassword ? (
							<Badge tone="warning" label="Cần đổi mật khẩu" />
						) : null}
						{account.activeSessions > 0 ? (
							<Badge
								tone="accent"
								label={`${account.activeSessions} phiên`}
							/>
						) : null}
						<Badge tone="neutral" label={lastLoginLabel(account)} />
					</div>
					<div className="flex flex-wrap gap-2 lg:justify-end">
						<RowButton
							disabled={saving}
							icon={KeyRound}
							label="Đặt lại mật khẩu"
							onClick={() => onAction({ account, type: "reset-password" })}
						/>
						<RowButton
							disabled={saving || account.role === "admin"}
							icon={ShieldCheck}
							label="Admin"
							onClick={() => onAction({ account, role: "admin", type: "role" })}
						/>
						<RowButton
							disabled={saving || account.role === "member"}
							label="Member"
							onClick={() => onAction({ account, role: "member", type: "role" })}
						/>
						<RowButton
							disabled={saving || account.activeSessions === 0}
							icon={LogOut}
							label="Thu hồi phiên"
							onClick={() => onAction({ account, type: "revoke-sessions" })}
						/>
						<RowButton
							disabled={saving}
							label={account.disabled ? "Bật lại" : "Tắt"}
							onClick={() =>
								onAction({
									account,
									disabled: !account.disabled,
									type: "disabled",
								})
							}
						/>
						<RowButton
							danger
							disabled={saving}
							icon={Trash2}
							label="Xóa"
							onClick={() => onAction({ account, type: "delete" })}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

function RowButton({
	danger = false,
	disabled,
	icon: Icon,
	label,
	onClick,
}: {
	danger?: boolean;
	disabled: boolean;
	icon?: typeof KeyRound;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
				danger
					? "border-[var(--danger-border)] text-[var(--danger-strong)] hover:bg-[var(--danger-soft)]"
					: "border-[var(--border)] text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
			}`}
		>
			{Icon ? <Icon size={13} /> : null}
			{label}
		</button>
	);
}

function IssuedPasswordCard({
	credential,
	onDismiss,
}: {
	credential: IssuedCredential;
	onDismiss: () => void;
}) {
	const [copied, setCopied] = useState(false);

	return (
		<div className="rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] p-3">
			<p className="text-[12px] font-bold text-[var(--accent-strong)]">
				Mật khẩu cho {credential.username}
			</p>
			<p className="mt-1 text-[11px] leading-4 text-[var(--accent-strong)] opacity-90">
				Mật khẩu này không hiển thị lại. Gửi cho người dùng qua kênh an toàn rồi
				đóng thông báo.
			</p>
			<div className="mt-2 flex flex-wrap items-center gap-2">
				<code className="min-w-0 flex-1 break-all rounded bg-[var(--surface)] px-3 py-2 text-[13px] font-bold text-[var(--foreground)]">
					{credential.password}
				</code>
				<button
					type="button"
					onClick={() => {
						void navigator.clipboard
							.writeText(credential.password)
							.then(() => setCopied(true))
							.catch(() => setCopied(false));
					}}
					className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[11px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
				>
					<Copy size={13} /> {copied ? "Đã sao chép" : "Sao chép"}
				</button>
				<button
					type="button"
					onClick={onDismiss}
					className="inline-flex h-9 items-center rounded-md px-3 text-[11px] font-bold text-[var(--accent-strong)] transition hover:bg-[var(--surface)]"
				>
					Đóng
				</button>
			</div>
		</div>
	);
}

function ConfirmDialog({
	action,
	onClose,
	onConfirm,
	saving,
}: {
	action: PendingAction | null;
	onClose: () => void;
	onConfirm: () => void;
	saving: boolean;
}) {
	if (!action) return null;

	const content = confirmationContent(action);

	return (
		<Dialog
			open
			onClose={onClose}
			title={content.title}
			description={action.account.username}
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

function Banner({
	message,
	tone,
}: {
	message: string;
	tone: "danger" | "success";
}) {
	return (
		<div
			className={`rounded-md border px-3 py-2 text-[12px] font-bold ${
				tone === "danger"
					? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-strong)]"
					: "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]"
			}`}
		>
			{message}
		</div>
	);
}

function Badge({
	label,
	tone,
}: {
	label: string;
	tone: "accent" | "danger" | "neutral" | "success" | "warning";
}) {
	const toneClass = {
		accent: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
		danger: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
		neutral: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]",
		success: "bg-[var(--success-soft)] text-[var(--success-strong)]",
		warning: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
	}[tone];

	return (
		<span
			className={`inline-flex h-6 items-center rounded-md px-2 text-[10px] font-bold ${toneClass}`}
		>
			{label}
		</span>
	);
}

function confirmationContent(action: PendingAction) {
	if (action.type === "delete") {
		return {
			title: "Xóa tài khoản mật khẩu?",
			warning:
				"Tài khoản và mọi phiên đăng nhập bị xóa vĩnh viễn. Thao tác không thể hoàn tác.",
		};
	}
	if (action.type === "reset-password") {
		return {
			title: "Đặt lại mật khẩu?",
			warning:
				"Mật khẩu mới sẽ được sinh tự động và mọi phiên đăng nhập hiện tại bị thu hồi.",
		};
	}
	if (action.type === "revoke-sessions") {
		return {
			title: "Thu hồi mọi phiên đăng nhập?",
			warning: "Người dùng sẽ phải đăng nhập lại trên tất cả thiết bị.",
		};
	}
	if (action.type === "role") {
		return {
			title: action.role === "admin" ? "Cấp quyền admin?" : "Chuyển về member?",
		};
	}
	return {
		title: action.disabled ? "Tắt tài khoản?" : "Bật lại tài khoản?",
		warning: action.disabled
			? "Người dùng sẽ bị đăng xuất và không thể đăng nhập lại."
			: undefined,
	};
}

function successMessage(action: PendingAction) {
	if (action.type === "delete") return "Đã xóa tài khoản.";
	if (action.type === "revoke-sessions") return "Đã thu hồi mọi phiên đăng nhập.";
	if (action.type === "role") return "Đã cập nhật vai trò.";
	if (action.type === "disabled") {
		return action.disabled ? "Đã tắt tài khoản." : "Đã bật lại tài khoản.";
	}
	return "Đã cập nhật tài khoản.";
}

function lastLoginLabel(account: LocalAccountView) {
	if (!account.lastLoginAt) return "Chưa đăng nhập";
	return `Đăng nhập ${new Date(account.lastLoginAt).toLocaleDateString("vi-VN")}`;
}
