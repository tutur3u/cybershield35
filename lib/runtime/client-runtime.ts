import { z } from "zod";

export const DEFAULT_GOOGLE_GENERATIVE_AI_MODEL = "gemini-2.5-flash";

export const credentialSourceSchema = z.enum(["server", "none"]);

export const clientRuntimeKeysSchema = z.object({}).strip().default({});

export const clientRuntimeSchema = z
	.object({ keys: z.unknown().optional() })
	.optional()
	.transform(() => ({ keys: {} }));

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

export function hasClientRuntimeKeys() {
	return false;
}

export function resolveCredential(
	serverValue: string | undefined,
): { value: string; source: Exclude<CredentialSource, "none"> } | null {
	const server = cleanSecret(serverValue);
	if (server) return { value: server, source: "server" };

	return null;
}

export function runtimeMode() {
	return "server";
}

export function runtimeKeySummary() {
	return {
		googleGenerativeAi: false,
		apify: false,
		firecrawl: false,
		browserUse: false,
	};
}

export function redactRuntimeSecrets(message: string) {
	return message;
}

export function cleanSecret(value: string | undefined | null) {
	const cleaned = value?.trim();
	return cleaned ? cleaned : undefined;
}
