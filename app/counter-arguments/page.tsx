import { redirect } from "next/navigation";

export const instant = true;
export const prefetch = "allow-runtime";

export default function CounterArgumentsPage() {
	redirect("/drafts");
}
