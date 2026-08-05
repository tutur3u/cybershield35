import { redirect } from "next/navigation";

export const instant = true;

export default function CounterArgumentsPage() {
	redirect("/drafts");
}
