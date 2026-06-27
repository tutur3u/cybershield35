import "server-only";

import { headers } from "next/headers";

import { requestUrlFromHeaders } from "@/lib/auth/request-url";

export async function requestFromCurrentHeaders() {
	const headerStore = await headers();
	const requestHeaders = new Headers();

	for (const [key, value] of headerStore.entries()) {
		requestHeaders.set(key, value);
	}

	return new Request(requestUrlFromHeaders(requestHeaders), {
		headers: requestHeaders,
	});
}
