import type { AuthViewState } from "@/components/dashboard/types";

export async function logout(
	setAuth: (auth: AuthViewState) => void,
	setNotice: (notice: string) => void,
	loginHref?: string,
) {
	await fetch("/api/auth/logout", { method: "POST" });
	setAuth({ authenticated: false, configured: true, loginHref });
	setNotice("");
	if (typeof window !== "undefined") {
		// A hard navigation is required after the HttpOnly session cookie is cleared.
		window.location.assign(
			new URL(loginHref ?? "/login", window.location.origin),
		);
	}
}
