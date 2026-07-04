import { CentralizedLoginScreen } from "@/components/auth/centralized-login-screen";
import type { LoginReason } from "@/lib/auth/routes";
import type {
	PendingInvitationPublicView,
	TuturuuuAuthDiagnostics,
} from "@/lib/auth/tuturuuu-session";

export function AuthRequiredScreen({
	authDiagnostics,
	configured,
	error,
	loginHref,
	pendingInvitation,
	pendingInvitationExpired,
	reason,
	scopeApprovalHref,
}: {
	authDiagnostics: TuturuuuAuthDiagnostics;
	configured: boolean;
	error?: string;
	loginHref?: string;
	pendingInvitation?: PendingInvitationPublicView | null;
	pendingInvitationExpired?: boolean;
	reason?: LoginReason | null;
	scopeApprovalHref?: string;
}) {
	return (
		<CentralizedLoginScreen
			authDiagnostics={authDiagnostics}
			configured={configured}
			error={error}
			loginHref={loginHref}
			pendingInvitation={pendingInvitation}
			pendingInvitationExpired={pendingInvitationExpired}
			reason={reason}
			scopeApprovalHref={scopeApprovalHref}
		/>
	);
}
