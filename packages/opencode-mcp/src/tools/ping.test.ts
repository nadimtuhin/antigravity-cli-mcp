import { describe, test, expect } from "bun:test";
import { pingHandler } from "./ping.js";

const F = import.meta.dir + "/../../test-fixtures";

function text(result: Awaited<ReturnType<typeof pingHandler>>): string {
  const item = result.content[0];
  if (item.type !== "text") throw new Error("expected text content");
  return item.text;
}

describe("pingHandler (opencode)", () => {
  test("binary found → version and workspace in output", async () => {
    const result = await pingHandler({
      cliCmdPath: `${F}/fake-opencode.sh`,
      workspaceRoot: "/my/workspace",
    });
    expect(result.isError).toBeUndefined();
    expect(text(result)).toContain("1.14.18");
    expect(text(result)).toContain("/my/workspace");
  }, 10_000);

  test("missing binary → isError with 'not found' in message", async () => {
    const result = await pingHandler({
      cliCmdPath: "/nonexistent/opencode",
      workspaceRoot: "/tmp",
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("not found");
  }, 10_000);

  test("binary exists but version exits non-zero → 'ping failed' not 'not found'", async () => {
    const result = await pingHandler({
      cliCmdPath: "/usr/bin/false",
      workspaceRoot: "/tmp",
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("ping failed");
    expect(text(result)).not.toContain("not found");
  }, 10_000);

  test("binary hangs → ping failed with timed out message", async () => {
    const result = await pingHandler({
      cliCmdPath: `${F}/fake-opencode-slow.sh`,
      workspaceRoot: "/tmp",
      timeoutMs: 200,
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("ping failed");
    expect(text(result)).toContain("timed out");
  }, 10_000);

  test("version exits non-zero with stderr → ping failed message includes stderr", async () => {
    const result = await pingHandler({
      cliCmdPath: `${F}/fake-opencode-version-error.sh`,
      workspaceRoot: "/tmp",
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("ping failed");
    expect(text(result)).toContain("opencode version check failed");
  }, 10_000);
});
