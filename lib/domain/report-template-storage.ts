import type { ReportSpec } from "@/components/dashboard/types";

export const REPORT_TEMPLATE_STORAGE_KEY = "cs35.report-templates.v1";

export type StoredReportTemplates = {
	customReports: ReportSpec[];
	hiddenReportKinds: string[];
	version: 1;
};

const emptyStoredReportTemplates: StoredReportTemplates = {
	customReports: [],
	hiddenReportKinds: [],
	version: 1,
};

export function parseStoredReportTemplates(raw: string | null): StoredReportTemplates {
	if (!raw) return emptyStoredReportTemplates;

	try {
		const value: unknown = JSON.parse(raw);
		if (!isRecord(value) || value.version !== 1) return emptyStoredReportTemplates;

		const customReports = Array.isArray(value.customReports)
			? value.customReports.filter(isReportSpec).slice(0, 30)
			: [];
		const hiddenReportKinds = Array.isArray(value.hiddenReportKinds)
			? value.hiddenReportKinds
					.filter((item): item is string => typeof item === "string")
					.slice(0, 30)
			: [];

		return { customReports, hiddenReportKinds, version: 1 };
	} catch {
		return emptyStoredReportTemplates;
	}
}

export function serializeStoredReportTemplates(
	customReports: ReportSpec[],
	hiddenReportKinds: string[],
) {
	return JSON.stringify({ customReports, hiddenReportKinds, version: 1 });
}

function isReportSpec(value: unknown): value is ReportSpec {
	return (
		isRecord(value) &&
		typeof value.kind === "string" &&
		value.kind.startsWith("custom-") &&
		typeof value.title === "string" &&
		value.title.trim().length > 0 &&
		typeof value.description === "string" &&
		value.description.trim().length > 0 &&
		Array.isArray(value.sections) &&
		value.sections.length > 0 &&
		value.sections.every((section) => typeof section === "string" && section.trim().length > 0)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
