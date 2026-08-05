import {
	clearLocalSessionCookie,
	readLocalSessionCookie,
} from "@/lib/auth/local-session";
import { clearSessionCookie } from "@/lib/auth/tuturuuu-session";

export async function POST(request: Request) {
	const localSession = readLocalSessionCookie(request);
	if (localSession) {
		// Revoke the row too, so the cookie cannot be replayed from a copy taken
		// before logout.
		const { revokeLocalSession } = await import("@/lib/auth/local-accounts");
		await revokeLocalSession(localSession.sessionId).catch(() => undefined);
	}

	const headers = new Headers({ "Cache-Control": "no-store" });
	headers.append("Set-Cookie", clearSessionCookie());
	headers.append("Set-Cookie", clearLocalSessionCookie());

	return Response.json({ ok: true }, { headers });
}
