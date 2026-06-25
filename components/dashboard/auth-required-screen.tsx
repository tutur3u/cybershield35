import {
	AlertTriangle,
	CheckCircle2,
	Server,
	ShieldCheck,
	type LucideIcon,
} from "lucide-react";

import type {
	EnvironmentDiagnostic,
	TuturuuuAuthDiagnostics,
} from "@/lib/auth/tuturuuu-session";

export function AuthRequiredScreen({
	authDiagnostics,
	configured,
	error,
}: {
	authDiagnostics: TuturuuuAuthDiagnostics;
	configured: boolean;
	error?: string;
}) {
	const runtimeDiagnostics = getRuntimeDiagnostics();

	return (
		<main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] sm:px-6">
			<div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center">
				<section className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
					<div className="flex items-start gap-3">
						<span className="grid size-11 shrink-0 place-items-center rounded-md bg-[var(--success-soft)] text-[var(--brand)]">
							<ShieldCheck size={22} />
						</span>
						<div className="min-w-0">
							<h1 className="text-[20px] font-bold leading-7">
								CyberShield 35
							</h1>
							<p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">
								Yêu cầu phiên Tuturuuu hợp lệ và cấu hình server-side trước
								khi mở bảng điều khiển.
							</p>
						</div>
					</div>

					<div
						className={`mt-5 flex items-start gap-3 rounded-lg p-4 ${
							configured
								? "bg-[var(--danger-soft)] text-[var(--danger-strong)]"
								: "bg-[var(--warning-soft)] text-[var(--warning-strong)]"
						}`}
					>
						<AlertTriangle size={20} className="mt-0.5 shrink-0" />
						<div className="min-w-0">
							<p className="text-[13px] font-bold">
								{configured
									? "Không có phiên quản trị hợp lệ"
									: "Cấu hình Tuturuuu chưa hoàn tất trên máy chủ"}
							</p>
							<p className="mt-1 text-[12px] leading-5 opacity-85">
								{configured
									? `${error ?? "Authentication required"}. Các env bắt buộc đã có; hãy mở từ Tuturuuu external app hoặc kiểm tra callback phiên.`
									: "Xem các dòng Thiếu hoặc Sai cấu hình bên dưới, cập nhật Vercel env rồi redeploy."}
							</p>
						</div>
					</div>

					<div className="mt-5 grid gap-4 lg:grid-cols-2">
						<SetupCard
							icon={Server}
							title="Tuturuuu Auth"
							description="Trong Vercel, vào Project Settings, Environment Variables, đặt các secret bắt buộc dưới đây cho Production và Preview rồi redeploy."
							items={[...authDiagnostics.required, ...authDiagnostics.optional]}
						/>
						<SetupCard
							icon={CheckCircle2}
							title="Runtime Services"
							description="Các provider, LLM và Postgres cũng phải được cấu hình trên server. Không nhập secret trong trình duyệt."
							items={runtimeDiagnostics}
						/>
					</div>

					<div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
						<p className="text-[13px] font-bold text-[var(--foreground)]">
							Local development
						</p>
						<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
							Chỉ trên localhost hoặc loopback, có thể đặt{" "}
							<code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--foreground)]">
								AUTH_LOCAL_BYPASS=true
							</code>{" "}
							khi <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--foreground)]">NODE_ENV</code>{" "}
							không phải production. Production luôn yêu cầu phiên Tuturuuu
							thật.
						</p>
					</div>
				</section>
			</div>
		</main>
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
