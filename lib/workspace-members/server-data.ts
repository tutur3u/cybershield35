import "server-only";

import { cache } from "react";

import type { WorkspaceMembersResponse } from "@/components/dashboard/types";
import { requestFromCurrentHeaders } from "@/lib/auth/current-request";
import { fetchWorkspaceMembersForRequest } from "@/lib/workspace-members/proxy";

export const emptyWorkspaceMembers: WorkspaceMembersResponse = {
	context: {
		canManageMembers: false,
		canManageRoles: false,
		defaultAdminEnabled: false,
	},
	invitations: [],
	members: [],
};

export const getWorkspaceMembersInitialData = cache(async () => {
	try {
		return await fetchWorkspaceMembersForRequest(await requestFromCurrentHeaders());
	} catch {
		return emptyWorkspaceMembers;
	}
});
