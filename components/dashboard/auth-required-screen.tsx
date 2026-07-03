import { CentralizedLoginScreen } from "@/components/auth/centralized-login-screen";
import type { LoginReason } from "@/lib/auth/routes";
import type { TuturuuuAuthDiagnostics } from "@/lib/auth/tuturuuu-session";

export function AuthRequiredScreen({
	authDiagnostics,
	configured,
	error,
	loginHref,
	reason,
	scopeApprovalHref,
}: {
	authDiagnostics: TuturuuuAuthDiagnostics;
	configured: boolean;
	error?: string;
	loginHref?: string;
	reason?: LoginReason | null;
	scopeApprovalHref?: string;
}) {
	return (
		<CentralizedLoginScreen
			authDiagnostics={authDiagnostics}
			configured={configured}
			error={error}
			loginHref={loginHref}
			reason={reason}
			scopeApprovalHref={scopeApprovalHref}
		/>
	);
}
