import "server-only";

import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";

const VERSION = "v1";

export function encryptZaloSecret(value: string) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
	const encrypted = Buffer.concat([
		cipher.update(value, "utf8"),
		cipher.final(),
	]);
	return [
		VERSION,
		iv.toString("base64url"),
		cipher.getAuthTag().toString("base64url"),
		encrypted.toString("base64url"),
	].join(".");
}

export function decryptZaloSecret(value: string) {
	const [version, ivValue, tagValue, encryptedValue] = value.split(".");
	if (
		version !== VERSION ||
		!ivValue ||
		!tagValue ||
		!encryptedValue
	) {
		throw new Error("Invalid encrypted Zalo secret");
	}
	const decipher = createDecipheriv(
		"aes-256-gcm",
		encryptionKey(),
		Buffer.from(ivValue, "base64url"),
	);
	decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
	return Buffer.concat([
		decipher.update(Buffer.from(encryptedValue, "base64url")),
		decipher.final(),
	]).toString("utf8");
}

function encryptionKey() {
	const secret = process.env.ZALO_TOKEN_ENCRYPTION_KEY?.trim();
	if (!secret || secret.length < 32) {
		throw new Error(
			"ZALO_TOKEN_ENCRYPTION_KEY must contain at least 32 characters",
		);
	}
	return createHash("sha256").update(secret).digest();
}
