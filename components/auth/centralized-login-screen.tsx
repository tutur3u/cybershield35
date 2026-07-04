import {
	AlertTriangle,
	CheckCircle2,
	ExternalLink,
	Server,
	type LucideIcon,
} from "lucide-react";

import { TuturuuuLoginLink } from "@/components/auth/tuturuuu-login-link";
import type { LoginReason } from "@/lib/auth/routes";
import type {
	EnvironmentDiagnostic,
	TuturuuuAuthDiagnostics,
} from "@/lib/auth/tuturuuu-session";

export function CentralizedLoginScreen({
	authDiagnostics,
	configured,
	error,
	invitationHref,
	loginHref,
	reason,
	scopeApprovalHref,
}: {
	authDiagnostics: TuturuuuAuthDiagnostics;
	configured: boolean;
	error?: string;
	invitationHref?: string;
	loginHref?: string;
	reason?: LoginReason | null;
	scopeApprovalHref?: string;
}) {
	const runtimeDiagnostics = getRuntimeDiagnostics();
	const authIssues = authDiagnostics.required.filter(isBlockingIssue);
	const runtimeIssues = runtimeDiagnostics.filter(isBlockingIssue);
	const setupIncomplete = authIssues.length > 0 || runtimeIssues.length > 0;
	const copy = loginCopy(reason, setupIncomplete, Boolean(scopeApprovalHref), error);

	return (
		<main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] sm:px-6">
			<div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-xl place-items-center">
				<section className="w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
					<h2 className="text-[24px] font-extrabold leading-8 text-[var(--foreground)]">
						{copy.title}
					</h2>
					<p className="mt-2 text-[13px] leading-5 text-[var(--muted)]">
						{copy.description}
					</p>

					{copy.notice ? (
						<div className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-[12px] leading-5 text-[var(--muted-strong)]">
							<CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--brand)]" />
							<p>{copy.notice}</p>
						</div>
					) : null}

					{scopeApprovalHref ? (
						<a
							href={scopeApprovalHref}
							className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-[13px] font-bold text-[var(--foreground)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)]"
						>
							<ExternalLink size={15} />
							Duyệt quyền truy cập
						</a>
					) : null}

					{invitationHref ? (
						<a
							href={invitationHref}
							className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-[13px] font-bold text-[var(--foreground)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)]"
						>
							<ExternalLink size={15} />
							Xem lời mời Tuturuuu
						</a>
					) : null}

					{loginHref && !setupIncomplete ? (
						<TuturuuuLoginLink href={loginHref} />
					) : (
						<button
							type="button"
							disabled
							className="mt-3 inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-md bg-[var(--surface-soft)] px-4 text-[13px] font-bold text-[var(--muted)]"
						>
							Đăng nhập chưa khả dụng
						</button>
					)}

					{setupIncomplete ? (
						<div className="mt-5 space-y-4">
							<SetupAlert configured={configured} error={error} />
							<div className="grid gap-4">
								{authIssues.length > 0 ? (
									<SetupCard
										icon={Server}
										title="Tuturuuu Auth"
										description="Trong Vercel, vào Project Settings, Environment Variables, đặt các secret bắt buộc cho Production và Preview rồi redeploy."
										items={authIssues}
									/>
								) : null}
								{runtimeIssues.length > 0 ? (
									<SetupCard
										icon={Server}
										title="Runtime Services"
										description="Các provider, LLM và Postgres phải được cấu hình server-side. Không nhập secret trong trình duyệt."
										items={runtimeIssues}
									/>
								) : null}
							</div>
							<LocalDevelopmentNote />
						</div>
					) : null}
				</section>
			</div>
		</main>
	);
}

function SetupAlert({
	configured,
	error,
}: {
	configured: boolean;
	error?: string;
}) {
	return (
		<div
			className={`flex items-start gap-3 rounded-lg p-4 ${
				configured
					? "bg-[var(--danger-soft)] text-[var(--danger-strong)]"
					: "bg-[var(--warning-soft)] text-[var(--warning-strong)]"
			}`}
		>
			<AlertTriangle size={20} className="mt-0.5 shrink-0" />
			<div className="min-w-0">
				<p className="text-[13px] font-bold">
					Cấu hình máy chủ chưa hoàn tất
				</p>
				<p className="mt-1 text-[12px] leading-5 opacity-85">
					{error && !configured ? `${error}. ` : ""}
					Xem các dòng Thiếu hoặc Sai cấu hình bên dưới, cập nhật Vercel env
					rồi redeploy.
				</p>
			</div>
		</div>
	);
}

function LocalDevelopmentNote() {
	return (
		<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
			<p className="text-[13px] font-bold text-[var(--foreground)]">
				Local development
			</p>
			<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
				Chỉ trên localhost hoặc loopback, có thể đặt{" "}
				<code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--foreground)]">
					AUTH_LOCAL_BYPASS=true
				</code>{" "}
				khi{" "}
				<code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--foreground)]">
					NODE_ENV
				</code>{" "}
				không phải production. Production luôn yêu cầu phiên Tuturuuu thật.
			</p>
		</div>
	);
}

function SetupCard({
	description,
	icon: Icon,
	items,
	title,
}: {
	description: string;
	icon: LucideIcon;
	items: EnvironmentDiagnostic[];
	title: string;
}) {
	return (
		<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
			<div className="flex items-start gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--surface)] text-[var(--brand)]">
					<Icon size={18} />
				</span>
				<div className="min-w-0">
					<p className="text-[13px] font-bold text-[var(--foreground)]">
						{title}
					</p>
					<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
						{description}
					</p>
				</div>
			</div>
			<ul className="mt-4 space-y-2">
				{items.map((item) => (
					<li
						key={item.name}
						className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
					>
						<div className="flex items-start justify-between gap-3">
							<code className="min-w-0 break-all text-[11px] font-bold text-[var(--foreground)]">
								{item.name}
							</code>
							<span
								className={`inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[10px] font-bold ${statusStyle(
									item.status,
								)}`}
							>
								{statusLabel(item.status)}
							</span>
						</div>
						<p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
							{item.message}
						</p>
					</li>
				))}
			</ul>
		</div>
	);
}

function loginCopy(
	reason: LoginReason | null | undefined,
	setupIncomplete: boolean,
	hasScopeApproval: boolean,
	error?: string,
) {
	if (setupIncomplete) {
		return {
			description:
				"Cấu hình máy chủ phải hoàn tất trước khi mở bảng điều khiển.",
			notice: null,
			title: "Cần hoàn tất cấu hình",
		};
	}

	if (hasScopeApproval || reason === "scope") {
		return {
			description:
				"Tài khoản cần được duyệt thêm quyền trước khi có thể mở bảng điều khiển.",
			notice: error ?? "Duyệt quyền, sau đó quay lại đăng nhập để tiếp tục.",
			title: "Cần duyệt quyền truy cập",
		};
	}

	if (reason === "invitation") {
		return {
			description:
				"Tài khoản có lời mời Tuturuuu đang chờ cho workspace này.",
			notice:
				"Mở Tuturuuu để chấp nhận hoặc từ chối lời mời, sau đó quay lại đăng nhập.",
			title: "Có lời mời đang chờ",
		};
	}

	if (reason === "no-access") {
		return {
			description:
				"Tài khoản Tuturuuu này chưa được cấp quyền truy cập bảng điều khiển.",
			notice:
				"Liên hệ quản trị viên CS35 để được thêm vào workspace hoặc đăng nhập bằng tài khoản khác.",
			title: "Không có quyền truy cập",
		};
	}

	if (reason === "expired") {
		return {
			description:
				"Phiên quản trị đã hết hạn hoặc không còn hợp lệ. Đăng nhập lại để tiếp tục.",
			notice: "CS35 giữ nguyên trang đích sau khi xác thực thành công.",
			title: "Đăng nhập lại",
		};
	}

	if (reason === "invalid-link") {
		return {
			description:
				"Liên kết xác thực không hợp lệ hoặc đã hết hạn. Bắt đầu lại từ Tuturuuu.",
			notice: "Không có token nào được nhập hoặc lưu trong trình duyệt.",
			title: "Liên kết đăng nhập không hợp lệ",
		};
	}

	return {
		description:
			"Sử dụng tài khoản Tuturuuu đã được cấp quyền để mở bảng điều khiển.",
		notice: null,
		title: "Đăng nhập để tiếp tục",
	};
}

function isBlockingIssue(item: EnvironmentDiagnostic) {
	return item.required && item.status !== "configured";
}

function getRuntimeDiagnostics(): EnvironmentDiagnostic[] {
	const llmConfigured = Boolean(
		cleanEnv(process.env.LLM_API_KEY) ||
			cleanEnv(process.env.OPENAI_API_KEY) ||
			cleanEnv(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
	);

	return [
		diagnoseRuntimeEnv("DATABASE_URL", "Postgres connection string for Neon."),
		{
			message: llmConfigured
				? "Configured through LLM_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY."
				: "Missing. Set LLM_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.",
			name: "LLM_API_KEY / OPENAI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY",
			required: true,
			status: llmConfigured ? "configured" : "missing",
		},
		diagnoseRuntimeEnv("APIFY_TOKEN", "Required for Facebook page, post, comment, and group collection."),
		diagnoseRuntimeEnv("FIRECRAWL_API_KEY", "Required for website crawling and parsing."),
		diagnoseRuntimeEnv("BROWSER_USE_API_KEY", "Required for Browser Use cloud browser automation."),
	];
}

function diagnoseRuntimeEnv(name: string, configuredMessage: string): EnvironmentDiagnostic {
	if (!cleanEnv(process.env[name])) {
		return {
			message: "Missing. Set this server-side in Vercel and redeploy.",
			name,
			required: true,
			status: "missing",
		};
	}

	return {
		message: configuredMessage,
		name,
		required: true,
		status: "configured",
	};
}

function cleanEnv(value: string | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function statusLabel(status: EnvironmentDiagnostic["status"]) {
	if (status === "configured") return "Đã cấu hình";
	if (status === "invalid") return "Sai cấu hình";
	if (status === "missing") return "Thiếu";
	return "Tùy chọn";
}

function statusStyle(status: EnvironmentDiagnostic["status"]) {
	if (status === "configured") {
		return "bg-[var(--success-soft)] text-[var(--success-strong)]";
	}
	if (status === "invalid") {
		return "bg-[var(--danger-soft)] text-[var(--danger-strong)]";
	}
	if (status === "missing") {
		return "bg-[var(--warning-soft)] text-[var(--warning-strong)]";
	}
	return "bg-[var(--accent-soft)] text-[var(--accent-strong)]";
}
