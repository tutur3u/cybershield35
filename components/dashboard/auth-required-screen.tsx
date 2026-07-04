import { CentralizedLoginScreen } from "@/components/auth/centralized-login-screen";
import type { LoginReason } from "@/lib/auth/routes";
import type { TuturuuuAuthDiagnostics } from "@/lib/auth/tuturuuu-session";

export function AuthRequiredScreen({
	authDiagnostics,
	configured,
	error,
	loginHref,
	invitationHref,
	reason,
	scopeApprovalHref,
}: {
	authDiagnostics: TuturuuuAuthDiagnostics;
	configured: boolean;
	error?: string;
	loginHref?: string;
	invitationHref?: string;
	reason?: LoginReason | null;
	scopeApprovalHref?: string;
}) {
	return (
		<CentralizedLoginScreen
			authDiagnostics={authDiagnostics}
			configured={configured}
			error={error}
			invitationHref={invitationHref}
			loginHref={loginHref}
			reason={reason}
			scopeApprovalHref={scopeApprovalHref}
		/>
	);
}
