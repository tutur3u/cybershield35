const INTERNAL_ERROR_MARKERS =
	/(failed query|params:|select\s+".*"\s+from|insert into|update\s+".*"\s+set|delete from|postgres|drizzle|database_url|password=|authorization:|bearer\s|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|stack trace)/i;

/**
 * Only pass through short, intentionally written Vietnamese domain messages.
 * Provider, database, configuration, and transport failures stay server-side.
 */
export function publicErrorMessage(error: unknown, fallback: string) {
	if (!(error instanceof Error)) return fallback;
	const message = error.message.trim();
	if (
		!message ||
		message.length > 240 ||
		!/[À-ỹ]/u.test(message) ||
		INTERNAL_ERROR_MARKERS.test(message)
	) {
		return fallback;
	}
	return message;
}
