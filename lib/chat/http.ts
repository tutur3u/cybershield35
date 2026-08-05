import type { AdminSessionAuth } from "@/lib/auth/require-admin";

import type { ChatActor } from "./types";

export function actorFromAuth(auth: AdminSessionAuth): ChatActor {
	const user = auth.session.user;
	return {
		displayName:
			user.displayName ?? user.display_name ?? user.fullName ?? user.full_name ?? user.name ?? null,
		id: user.id,
	};
}

export function chatError(error: unknown, fallback: string) {
	return Response.json(
		{ error: error instanceof Error ? error.message : fallback },
		{ status: 500 },
	);
}
