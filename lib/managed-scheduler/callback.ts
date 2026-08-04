export type ManagedSchedulerCallbackOperation =
	| "daily-scans"
	| "enqueue-tracked-sources"
	| "process-queue";

export function managedSchedulerCallbackFailureBody({
	error,
	operation,
}: {
	error: unknown;
	operation: ManagedSchedulerCallbackOperation;
}) {
	return {
		code: "CS35_MANAGED_SCHEDULER_CALLBACK_FAILED",
		developerDebug: {
			operation,
			reason: callbackFailureReason(error),
		},
		error: callbackFailureMessage(operation),
		operation,
	};
}

function callbackFailureMessage(operation: ManagedSchedulerCallbackOperation) {
	if (operation === "daily-scans") {
		return "CS35 could not complete the daily source scan. Check server logs, database connectivity, and provider configuration.";
	}
	if (operation === "enqueue-tracked-sources") {
		return "CS35 could not enqueue tracked sources from the managed scheduler callback. Check CS35 server logs, database connectivity, and provider configuration.";
	}

	return "CS35 could not process the scan queue from the managed scheduler callback. Check CS35 server logs, database connectivity, and provider configuration.";
}

function callbackFailureReason(error: unknown) {
	if (!error) return "unknown";
	if (error instanceof Error) {
		if (/timeout|timed out|abort/iu.test(error.message)) return "timeout";
		if (/database|postgres|connection|fetch failed|network/iu.test(error.message)) {
			return "dependency_unavailable";
		}
		return "internal_error";
	}

	return "internal_error";
}
