"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { AuthViewState } from "@/components/dashboard/types";

const DashboardAuthContext = createContext<AuthViewState | null>(null);

export function DashboardAuthProvider({
	children,
	initialAuth,
}: {
	children: ReactNode;
	initialAuth: AuthViewState;
}) {
	return (
		<DashboardAuthContext.Provider value={initialAuth}>
			{children}
		</DashboardAuthContext.Provider>
	);
}

export function useDashboardAuthState() {
	return useContext(DashboardAuthContext);
}
