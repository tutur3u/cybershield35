import "server-only";

import type { LocalAccountsResponse } from "@/components/dashboard/types";
import { requestFromCurrentHeaders } from "@/lib/auth/current-request";
import { listLocalAccounts } from "@/lib/auth/local-accounts";
import { requireLocalAccountAdmin } from "@/lib/local-accounts/admin-guard";

export const emptyLocalAccounts: LocalAccountsResponse = {
	accounts: [],
	context: { canManage: false },
};

export async function getLocalAccountsInitialData(): Promise<LocalAccountsResponse> {
	try {
		const guard = await requireLocalAccountAdmin(await requestFromCurrentHeaders());
		if (!guard.authorized) {
			return { accounts: [], context: { canManage: false, reason: guard.error } };
		}

		return { accounts: await listLocalAccounts(), context: { canManage: true } };
	} catch {
		return emptyLocalAccounts;
	}
}
