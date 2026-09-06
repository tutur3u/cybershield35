import { afterEach, expect, test } from "bun:test";
import { getTuturuuuMachineToken } from "@/lib/tuturuuu/machine-credential";

const originalToken = process.env.TUTURUUU_AI_APP_TOKEN;
const originalKey = process.env.TUTURUUU_AI_API_KEY;
afterEach(() => {
  for (const [name, value] of [
    ["TUTURUUU_AI_APP_TOKEN", originalToken],
    ["TUTURUUU_AI_API_KEY", originalKey],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("reuses the deployed API key when the token is absent or blank", () => {
  process.env.TUTURUUU_AI_API_KEY = " deployed-test-key ";
  delete process.env.TUTURUUU_AI_APP_TOKEN;
  expect(getTuturuuuMachineToken()).toBe("deployed-test-key");
  process.env.TUTURUUU_AI_APP_TOKEN = " ";
  expect(getTuturuuuMachineToken()).toBe("deployed-test-key");
  process.env.TUTURUUU_AI_APP_TOKEN = " explicit-test-token ";
  expect(getTuturuuuMachineToken()).toBe("explicit-test-token");
});
