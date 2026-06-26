export function requestUrlFromHeaders(headers: Headers) {
	const host =
		firstForwardedValue(headers.get("x-forwarded-host")) ??
		firstForwardedValue(headers.get("host")) ??
		"localhost";
	const protocol =
		firstForwardedValue(headers.get("x-forwarded-proto")) ??
		(isLoopbackHost(host) ? "http" : "https");
	const pathname = safePathname(headers.get("x-cybershield-pathname"));
	const search = safeSearch(headers.get("x-cybershield-search"));

	return `${protocol}://${host}${pathname}${search}`;
}

function firstForwardedValue(value: string | null) {
	return value
		?.split(",")
		.map((part) => part.trim())
		.find(Boolean);
}

function isLoopbackHost(host: string) {
	const hostname = host.startsWith("[")
		? host.slice(1, host.indexOf("]"))
		: (host.split(":")[0] ?? "");

	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname === "0.0.0.0" ||
		hostname === "::1"
	);
}

function safePathname(value: string | null) {
	return value?.startsWith("/") ? value : "/";
}

function safeSearch(value: string | null) {
	if (!value) return "";
	return value.startsWith("?") ? value : "";
}
