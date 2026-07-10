import { isServer, QueryClient } from "@tanstack/react-query";

const staleTime = 5 * 60_000;
const gcTime = 30 * 60_000;

function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				gcTime,
				refetchOnWindowFocus: false,
				retry: 1,
				staleTime,
			},
		},
	});
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
	if (isServer) return makeQueryClient();

	browserQueryClient ??= makeQueryClient();
	return browserQueryClient;
}
