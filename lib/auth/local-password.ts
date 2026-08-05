import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const MIN_LOCAL_PASSWORD_LENGTH = 12;
export const MAX_LOCAL_PASSWORD_LENGTH = 128;
export const MIN_LOCAL_USERNAME_LENGTH = 3;
export const MAX_LOCAL_USERNAME_LENGTH = 48;

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
// scrypt needs roughly 128 * N * r bytes; the default 32MB cap is below what
// cost 16384 asks for, so the limit is raised explicitly instead of silently
// falling back to a weaker cost factor.
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/u;
const GENERATED_PASSWORD_ALPHABET =
	"abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeLocalUsername(rawValue: string) {
	return rawValue.trim().toLowerCase();
}

export function localUsernameIssue(username: string) {
	if (username.length < MIN_LOCAL_USERNAME_LENGTH) {
		return `Tên đăng nhập phải có ít nhất ${MIN_LOCAL_USERNAME_LENGTH} ký tự.`;
	}
	if (username.length > MAX_LOCAL_USERNAME_LENGTH) {
		return `Tên đăng nhập tối đa ${MAX_LOCAL_USERNAME_LENGTH} ký tự.`;
	}
	if (!USERNAME_PATTERN.test(username)) {
		return "Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm, gạch ngang và gạch dưới.";
	}
	return null;
}

export function localPasswordIssue(password: string) {
	if (password.length < MIN_LOCAL_PASSWORD_LENGTH) {
		return `Mật khẩu phải có ít nhất ${MIN_LOCAL_PASSWORD_LENGTH} ký tự.`;
	}
	if (password.length > MAX_LOCAL_PASSWORD_LENGTH) {
		return `Mật khẩu tối đa ${MAX_LOCAL_PASSWORD_LENGTH} ký tự.`;
	}
	if (!/[a-z]/u.test(password) || !/[A-Z]/u.test(password)) {
		return "Mật khẩu phải có cả chữ hoa và chữ thường.";
	}
	if (!/[0-9]/u.test(password)) {
		return "Mật khẩu phải có ít nhất một chữ số.";
	}
	return null;
}

export function generateLocalPassword(length = 20): string {
	const bytes = randomBytes(length * 2);
	let password = "";
	for (let index = 0; password.length < length; index += 1) {
		const byte = bytes[index % bytes.length] ?? 0;
		password += GENERATED_PASSWORD_ALPHABET[byte % GENERATED_PASSWORD_ALPHABET.length];
	}

	// Regenerate rather than patch, so every issued password keeps full entropy
	// instead of ending with predictable filler characters.
	return localPasswordIssue(password) ? generateLocalPassword(length) : password;
}

export async function hashLocalPassword(password: string) {
	const salt = randomBytes(16);
	const derived = await deriveKey(password, salt);
	return [
		"scrypt",
		SCRYPT_COST,
		SCRYPT_BLOCK_SIZE,
		SCRYPT_PARALLELIZATION,
		salt.toString("base64url"),
		derived.toString("base64url"),
	].join("$");
}

export async function verifyLocalPassword(password: string, stored: string) {
	const parsed = parseStoredHash(stored);
	if (!parsed) return false;

	const derived = await deriveKey(password, parsed.salt, parsed);
	if (derived.length !== parsed.hash.length) return false;
	return timingSafeEqual(derived, parsed.hash);
}

function parseStoredHash(stored: string) {
	const [algorithm, cost, blockSize, parallelization, salt, hash] =
		stored.split("$");
	if (algorithm !== "scrypt" || !salt || !hash) return null;

	const parsedCost = Number(cost);
	const parsedBlockSize = Number(blockSize);
	const parsedParallelization = Number(parallelization);
	if (
		!Number.isSafeInteger(parsedCost) ||
		!Number.isSafeInteger(parsedBlockSize) ||
		!Number.isSafeInteger(parsedParallelization)
	) {
		return null;
	}

	return {
		blockSize: parsedBlockSize,
		cost: parsedCost,
		hash: Buffer.from(hash, "base64url"),
		parallelization: parsedParallelization,
		salt: Buffer.from(salt, "base64url"),
	};
}

function deriveKey(
	password: string,
	salt: Buffer,
	params: {
		blockSize: number;
		cost: number;
		hash?: Buffer;
		parallelization: number;
	} = {
		blockSize: SCRYPT_BLOCK_SIZE,
		cost: SCRYPT_COST,
		parallelization: SCRYPT_PARALLELIZATION,
	},
) {
	const keyLength = params.hash?.length ?? SCRYPT_KEY_LENGTH;

	return new Promise<Buffer>((resolve, reject) => {
		scrypt(
			password.normalize("NFKC"),
			salt,
			keyLength,
			{
				N: params.cost,
				maxmem: SCRYPT_MAX_MEMORY,
				p: params.parallelization,
				r: params.blockSize,
			},
			(error, derived) => {
				if (error) reject(error);
				else resolve(derived);
			},
		);
	});
}
