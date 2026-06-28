import {
	buildTuturuuuCentralizedLoginUrl,
	getTuturuuuWebAppUrl,
} from "@/lib/auth/login-link";
import { getRequestedScopes } from "@/lib/auth/tuturuuu-session";

export const TUTURUUU_SCOPE_NOT_ALLOWED_ERROR =
	"Requested scope is not allowed for this app";

export function isTuturuuuScopeNotAllowedError({
	error,
	status,
}: {
	error?: string;
	status?: number;
}) {
	return status === 403 && error === TUTURUUU_SCOPE_NOT_ALLOWED_ERROR;
}

export function buildTuturuuuScopeApprovalUrl({
	appBaseUrl,
	nextUrl = "/",
}: {
	appBaseUrl: string;
	nextUrl?: string;
}) {
	const appId = cleanEnv(process.env.CYBERSHIELD35_APP_ID);
	if (!appId) return undefined;

	const webAppUrl = getTuturuuuWebAppUrl();
	const approvalBaseUrl =
		cleanEnv(process.env.TUTURUUU_EXTERNAL_APP_APPROVAL_URL) ??
		`${webAppUrl}/vi/internal/infrastructure/external-apps/approve`;

	let approvalUrl: URL;
	try {
		approvalUrl = new URL(approvalBaseUrl);
	} catch {
		return undefined;
	}

	approvalUrl.searchParams.set("appId", appId);
	approvalUrl.searchParams.delete("scope");
	for (const scope of getRequestedScopes()) {
		approvalUrl.searchParams.append("scope", scope);
	}
	approvalUrl.searchParams.set(
		"returnUrl",
		buildTuturuuuCentralizedLoginUrl({
			appBaseUrl,
			nextUrl,
			webAppUrl,
		}),
	);

	return approvalUrl.toString();
}

export function buildManagedSchedulerApprovalUrl({
	appBaseUrl,
	origin,
	returnPath = "/settings",
}: {
	appBaseUrl: string;
	origin: string;
	returnPath?: string;
}) {
	const appId = cleanEnv(process.env.CYBERSHIELD35_APP_ID);
	const workspaceId = cleanEnv(process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID);
	if (!appId || !workspaceId) return undefined;

	const approvalUrl = createApprovalUrl();
	if (!approvalUrl) return undefined;

	approvalUrl.searchParams.set("appId", appId);
	approvalUrl.searchParams.set("feature", "managed-cron");
	approvalUrl.searchParams.set("workspaceId", workspaceId);
	approvalUrl.searchParams.set("origin", origin);
	approvalUrl.searchParams.delete("scope");
	for (const scope of getRequestedScopes()) {
		approvalUrl.searchParams.append("scope", scope);
	}
	approvalUrl.searchParams.set(
		"returnUrl",
		buildReturnUrlWithCronRetry({ appBaseUrl, returnPath }),
	);

	return approvalUrl.toString();
}

function createApprovalUrl() {
	const webAppUrl = getTuturuuuWebAppUrl();
	const approvalBaseUrl =
		cleanEnv(process.env.TUTURUUU_EXTERNAL_APP_APPROVAL_URL) ??
		`${webAppUrl}/vi/internal/infrastructure/external-apps/approve`;

	try {
		return new URL(approvalBaseUrl);
	} catch {
		return null;
	}
}

function buildReturnUrlWithCronRetry({
	appBaseUrl,
	returnPath,
}: {
	appBaseUrl: string;
	returnPath: string;
}) {
	const base = appBaseUrl.endsWith("/") ? appBaseUrl : `${appBaseUrl}/`;
	const returnUrl = new URL(returnPath.replace(/^\/+/u, ""), base);
	returnUrl.searchParams.set("cronSetup", "retry");
	return returnUrl.toString();
}

function cleanEnv(value: string | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}
