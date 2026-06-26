import { createHmac, timingSafeEqual } from "node:crypto";

const AVATAR_UPLOAD_PROOF_TTL_MS = 5 * 60 * 1000;

type AvatarUploadProofPayload = {
	exp: number;
	filePath: string;
	publicUrl: string;
	userId: string;
};

export function createAvatarUploadProof(input: {
	filePath: string;
	publicUrl: string;
	userId: string;
}) {
	const payload: AvatarUploadProofPayload = {
		exp: Date.now() + AVATAR_UPLOAD_PROOF_TTL_MS,
		filePath: input.filePath,
		publicUrl: input.publicUrl,
		userId: input.userId,
	};
	const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyAvatarUploadProof(input: {
	proof: string;
	publicUrl: string;
	userId: string;
}) {
	const [encodedPayload, signature] = input.proof.split(".");
	if (!encodedPayload || !signature) return false;
	if (!constantTimeEqual(signature, sign(encodedPayload))) return false;

	try {
		const payload = JSON.parse(
			Buffer.from(encodedPayload, "base64url").toString("utf8"),
		) as Partial<AvatarUploadProofPayload>;

		return (
			typeof payload.exp === "number" &&
			payload.exp >= Date.now() &&
			payload.publicUrl === input.publicUrl &&
			payload.userId === input.userId &&
			typeof payload.filePath === "string" &&
			payload.filePath.length > 0
		);
	} catch {
		return false;
	}
}

function sign(value: string) {
	return createHmac("sha256", proofSecret()).update(value).digest("base64url");
}

function proofSecret() {
	const secret =
		process.env.CYBERSHIELD35_SESSION_SECRET ??
		process.env.CYBERSHIELD35_APP_SECRET;
	if (!secret?.trim()) {
		throw new Error(
			"CYBERSHIELD35_SESSION_SECRET or CYBERSHIELD35_APP_SECRET is required",
		);
	}
	return secret.trim();
}

function constantTimeEqual(left: string, right: string) {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	return (
		leftBuffer.length === rightBuffer.length &&
		timingSafeEqual(leftBuffer, rightBuffer)
	);
}
