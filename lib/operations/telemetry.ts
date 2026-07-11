import "server-only";

import { adminDb } from "@/lib/db/client";
import { scanJobEvents } from "@/lib/db/schema";

export type ScanPipelineStage =
	| "queue"
	| "provider"
	| "evidence"
	| "analysis"
	| "topics"
	| "complete";

type StructuredLogLevel = "error" | "info" | "warn";

export function logOperation(
	event: string,
	fields: Record<string, boolean | null | number | string | undefined> = {},
	level: StructuredLogLevel = "info",
) {
	const payload = JSON.stringify({
		event,
		level,
		service: "cybershield35",
		ts: new Date().toISOString(),
		...compactFields(fields),
	});
	if (level === "error") console.error(payload);
	else if (level === "warn") console.warn(payload);
	else console.log(payload);
}

export async function recordScanEvent(input: {
	eventType: string;
	message: string;
	metadata?: Record<string, boolean | null | number | string>;
	scanJobId: string;
	stage: ScanPipelineStage;
	status: "completed" | "failed" | "running" | "waiting";
}) {
	try {
		await adminDb.insert(scanJobEvents).values({
			eventType: input.eventType,
			message: input.message,
			metadata: input.metadata ?? {},
			scanJobId: input.scanJobId,
			stage: input.stage,
			status: input.status,
		});
		logOperation("scan_pipeline_event", {
			eventType: input.eventType,
			scanJobId: input.scanJobId,
			stage: input.stage,
			status: input.status,
		});
	} catch (error) {
		// Telemetry must never prevent a scan from progressing during a rolling deploy.
		logOperation(
			"scan_pipeline_event_write_failed",
			{
				errorType: error instanceof Error ? error.name : "UnknownError",
				scanJobId: input.scanJobId,
				stage: input.stage,
			},
			"warn",
		);
	}
}

function compactFields(
	fields: Record<string, boolean | null | number | string | undefined>,
) {
	return Object.fromEntries(
		Object.entries(fields).filter((entry) => entry[1] !== undefined),
	);
}
