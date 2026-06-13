import { z } from "zod";

export const DEFAULT_GOOGLE_GENERATIVE_AI_MODEL = "gemini-2.5-flash";

export const credentialSourceSchema = z.enum(["server", "browser_session", "demo"]);

export const clientRuntimeKeysSchema = z
	.object({
		googleGenerativeAiApiKey: z.string().optional(),
		googleGenerativeAiModel: z.string().optional(),
		apifyToken: z.string().optional(),
		firecrawlApiKey: z.string().optional(),
		browserUseApiKey: z.string().optional(),
	})
	.default({});

export const clientRuntimeSchema = z
	.object({
		keys: clientRuntimeKeysSchema.optional(),
	})
	.optional()
	.transform((runtime) => ({
		keys: normalizeRuntimeKeys(runtime?.keys ?? {}),
	}));

export type CredentialSource = z.infer<typeof credentialSourceSchema>;
export type ClientRuntimeKeys = z.infer<typeof clientRuntimeKeysSchema>;
export type ClientRuntime = {
	keys: ClientRuntimeKeys;
};

export function parseClientRuntime(input: unknown): ClientRuntime {
	return clientRuntimeSchema.parse(input);
}

export function parseClientRuntimeFormValue(value: FormDataEntryValue | null) {
	if (typeof value !== "string" || !value.trim()) return parseClientRuntime(undefined);
	try {
		return parseClientRuntime(JSON.parse(value));
	} catch {
		return parseClientRuntime(undefined);
	}
}

export function hasClientRuntimeKeys(runtime?: ClientRuntime | null) {
	const keys = runtime?.keys;
	return Boolean(
		keys?.googleGenerativeAiApiKey ||
			keys?.apifyToken ||
			keys?.firecrawlApiKey ||
			keys?.browserUseApiKey,
	);
}

export function resolveCredential(
	serverValue: string | undefined,
	clientValue: string | undefined,
): { value: string; source: Exclude<CredentialSource, "demo"> } | null {
	const server = cleanSecret(serverValue);
	if (server) return { value: server, source: "server" };

	const client = cleanSecret(clientValue);
	if (client) return { value: client, source: "browser_session" };

	return null;
}

export function runtimeMode(runtime?: ClientRuntime | null) {
	return hasClientRuntimeKeys(runtime) ? "browser_session" : "server_or_demo";
}

export function runtimeKeySummary(runtime?: ClientRuntime | null) {
	const keys = runtime?.keys;
	return {
		googleGenerativeAi: Boolean(keys?.googleGenerativeAiApiKey),
		apify: Boolean(keys?.apifyToken),
		firecrawl: Boolean(keys?.firecrawlApiKey),
		browserUse: Boolean(keys?.browserUseApiKey),
	};
}

export function redactRuntimeSecrets(
	message: string,
	runtime?: ClientRuntime | null,
) {
	let redacted = message;
	const values = Object.values(runtime?.keys ?? {}).filter(
		(value): value is string => typeof value === "string" && value.length >= 6,
	);
	for (const value of values) {
		redacted = redacted.split(value).join("[redacted]");
	}
	return redacted;
}

export function cleanSecret(value: string | undefined | null) {
	const cleaned = value?.trim();
	return cleaned ? cleaned : undefined;
}

function normalizeRuntimeKeys(keys: ClientRuntimeKeys): ClientRuntimeKeys {
	return {
		googleGenerativeAiApiKey: cleanSecret(keys.googleGenerativeAiApiKey),
		googleGenerativeAiModel:
			cleanSecret(keys.googleGenerativeAiModel) ??
			(keys.googleGenerativeAiApiKey
				? DEFAULT_GOOGLE_GENERATIVE_AI_MODEL
				: undefined),
		apifyToken: cleanSecret(keys.apifyToken),
		firecrawlApiKey: cleanSecret(keys.firecrawlApiKey),
		browserUseApiKey: cleanSecret(keys.browserUseApiKey),
	};
}
