import { existsSync, readFileSync } from "node:fs";

export function loadLocalEnvFile(path = ".env.local") {
	if (!existsSync(path)) return;

	const lines = readFileSync(path, "utf8").split(/\r?\n/u);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const separator = trimmed.indexOf("=");
		if (separator <= 0) continue;

		const key = trimmed.slice(0, separator).trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) continue;
		if (process.env[key]) continue;

		process.env[key] = parseEnvValue(trimmed.slice(separator + 1).trim());
	}
}

function parseEnvValue(value: string) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}

	return value;
}
