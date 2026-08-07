import { permanentRedirect } from "next/navigation";

export const instant = true;

export default function NewArticlePage() {
	permanentRedirect("/evidence");
}
