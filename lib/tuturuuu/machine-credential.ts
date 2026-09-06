import { cleanSecret } from "@/lib/runtime/client-runtime";

/** Reuse the deployed AI Studio key while preserving explicit token overrides. */
export function getTuturuuuMachineToken() {
  return cleanSecret(process.env.TUTURUUU_AI_APP_TOKEN)
    ?? cleanSecret(process.env.TUTURUUU_AI_API_KEY);
}
