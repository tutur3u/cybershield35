/**
 * A collection failure is only worth retrying when the thing that broke can fix
 * itself. An exhausted account quota cannot: retrying it burns the queue for
 * hours and leaves every scan showing "Thử lại" as though the system were
 * recovering, while the operator has no idea that the real fix is to top up the
 * provider account.
 *
 * So provider failures carry a classification and a message written for the
 * person who has to act on it, not a stack trace.
 */
export type ProviderFailureCode =
	| "provider_capacity_exhausted"
	| "provider_credential_missing"
	| "provider_credential_rejected"
	| "provider_quota_exhausted"
	| "provider_rate_limited"
	| "provider_source_unavailable"
	| "provider_unavailable";

export class ProviderCollectionError extends Error {
	readonly code: ProviderFailureCode;
	/** Vietnamese, addressed to the operator, describing the fix. */
	readonly operatorMessage: string;
	readonly retryable: boolean;
	readonly provider: string;

	constructor(input: {
		cause?: unknown;
		code: ProviderFailureCode;
		operatorMessage: string;
		provider: string;
		retryable: boolean;
		technicalMessage: string;
	}) {
		super(input.technicalMessage, { cause: input.cause });
		this.name = "ProviderCollectionError";
		this.code = input.code;
		this.operatorMessage = input.operatorMessage;
		this.provider = input.provider;
		this.retryable = input.retryable;
	}
}

export function isProviderCollectionError(
	error: unknown,
): error is ProviderCollectionError {
	return error instanceof ProviderCollectionError;
}

/**
 * Whether a scan that hit this error should be retried at all. Anything we did
 * not classify keeps the old behaviour of retrying, because an unknown fault is
 * more often transient than terminal.
 */
export function isRetryableCollectionError(error: unknown) {
	return isProviderCollectionError(error) ? error.retryable : true;
}

export function operatorMessageFor(error: unknown) {
	if (isProviderCollectionError(error)) return error.operatorMessage;
	return null;
}

type ApifyApiErrorShape = {
	message?: unknown;
	statusCode?: unknown;
	type?: unknown;
};

function apifyErrorShape(error: unknown): ApifyApiErrorShape | null {
	if (!error || typeof error !== "object") return null;
	return error as ApifyApiErrorShape;
}

/**
 * Maps an Apify API failure onto the classification above.
 *
 * The quota case is the one that matters in practice: Apify answers
 * `403 platform-feature-disabled / "Monthly usage hard limit exceeded"` once the
 * account's monthly spend cap is reached, and every subsequent actor call fails
 * identically until the cycle resets or the plan is raised.
 */
export function classifyApifyError(
	error: unknown,
	provider: string,
): ProviderCollectionError {
	const shape = apifyErrorShape(error);
	const type = typeof shape?.type === "string" ? shape.type : "";
	const status = typeof shape?.statusCode === "number" ? shape.statusCode : 0;
	const rawMessage =
		typeof shape?.message === "string" && shape.message.trim()
			? shape.message.trim()
			: error instanceof Error
				? error.message
				: String(error);
	const lowered = rawMessage.toLowerCase();

	/*
	 * Memory is billed across every concurrent actor run against one
	 * account-wide ceiling, so launching one scan too many is refused outright:
	 * "By launching this job you will exceed the memory limit of 16384MB for
	 * all your Actor runs and builds". This looks fatal and reads fatal, but it
	 * is the most transient failure there is — it clears the moment another run
	 * finishes. Checked before the quota branch: both messages talk about
	 * limits, and only one of them means the account is out of money — reading
	 * this one as terminal would park a recoverable scan forever.
	 */
	const memoryExhausted =
		lowered.includes("memory limit") ||
		lowered.includes("exceed the memory") ||
		type === "limit-exceeded";

	if (memoryExhausted) {
		return new ProviderCollectionError({
			cause: error,
			code: "provider_capacity_exhausted",
			operatorMessage:
				"Apify đang chạy hết bộ nhớ cho phép vì có quá nhiều lượt quét cùng lúc. Hệ thống sẽ tự thử lại khi có chỗ trống — không cần làm gì thêm.",
			provider,
			retryable: true,
			technicalMessage: rawMessage,
		});
	}

	const quotaExhausted =
		type === "platform-feature-disabled" ||
		lowered.includes("usage hard limit") ||
		lowered.includes("monthly usage") ||
		status === 402;

	if (quotaExhausted) {
		return new ProviderCollectionError({
			cause: error,
			code: "provider_quota_exhausted",
			operatorMessage:
				"Tài khoản Apify đã dùng hết hạn mức chi tiêu trong tháng nên không thể thu thập dữ liệu Facebook. Hãy nâng gói hoặc chờ chu kỳ tính phí mới, sau đó chạy lại lượt quét.",
			provider,
			retryable: false,
			technicalMessage: rawMessage,
		});
	}

	if (status === 401 || type === "token-not-provided" || type === "invalid-token") {
		return new ProviderCollectionError({
			cause: error,
			code: "provider_credential_rejected",
			operatorMessage:
				"Apify từ chối khóa truy cập đang dùng. Hãy cập nhật APIFY_TOKEN rồi chạy lại lượt quét.",
			provider,
			retryable: false,
			technicalMessage: rawMessage,
		});
	}

	if (status === 429 || type === "rate-limit-exceeded") {
		return new ProviderCollectionError({
			cause: error,
			code: "provider_rate_limited",
			operatorMessage:
				"Apify đang giới hạn tần suất gọi. Hệ thống sẽ tự thử lại sau ít phút.",
			provider,
			retryable: true,
			technicalMessage: rawMessage,
		});
	}

	if (status === 404 || type === "record-not-found") {
		return new ProviderCollectionError({
			cause: error,
			code: "provider_source_unavailable",
			operatorMessage:
				"Không mở được nguồn này trên Facebook. Hãy kiểm tra đường dẫn còn công khai hay không.",
			provider,
			retryable: false,
			technicalMessage: rawMessage,
		});
	}

	return new ProviderCollectionError({
		cause: error,
		code: "provider_unavailable",
		operatorMessage:
			"Dịch vụ thu thập dữ liệu tạm thời không phản hồi. Hệ thống sẽ tự thử lại.",
		provider,
		retryable: true,
		technicalMessage: rawMessage,
	});
}
