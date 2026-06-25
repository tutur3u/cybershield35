export function buildTuturuuuCentralizedLoginUrl({
	appBaseUrl,
	nextUrl = "/",
	webAppUrl = getTuturuuuWebAppUrl(),
}: {
	appBaseUrl: string;
	nextUrl?: string;
	webAppUrl?: string;
}) {
	const appOrigin = new URL(appBaseUrl).origin;
	const verifyUrl = new URL("/verify-token", appOrigin);
	verifyUrl.searchParams.set("nextUrl", sanitizeNextPath(nextUrl, appOrigin));

	const loginUrl = new URL("/login", webAppUrl);
	loginUrl.searchParams.set("returnUrl", verifyUrl.toString());
	return loginUrl.toString();
}

export function sanitizeNextPath(
	rawValue: string | null | undefined,
	requestOrigin = "http://localhost",
	fallbackPath = "/",
) {
	if (!rawValue?.trim() || rawValue.startsWith("//")) return fallbackPath;

	try {
		const parsed = new URL(rawValue, requestOrigin);
		if (parsed.origin !== requestOrigin) return fallbackPath;
		return `${parsed.pathname}${parsed.search}`;
	} catch {
		return fallbackPath;
	}
}

function getTuturuuuWebAppUrl() {
	const configured =
		process.env.TUTURUUU_WEB_APP_URL ?? process.env.NEXT_PUBLIC_TUTURUUU_WEB_APP_URL;
	if (configured?.trim()) return trimTrailingSlash(configured.trim());
	return process.env.NODE_ENV === "development"
		? "http://localhost:7803"
		: "https://tuturuuu.com";
}

function trimTrailingSlash(value: string) {
	return value.replace(/\/+$/u, "");
}
