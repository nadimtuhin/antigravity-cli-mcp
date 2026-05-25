import { describe, test, expect } from "bun:test";
import { pingHandler } from "./ping.js";

const F = import.meta.dir + "/../../test-fixtures";

function text(result: Awaited<ReturnType<typeof pingHandler>>): string {
  const item = result.content[0];
  if (item.type !== "text") throw new Error("expected text content");
  return item.text;
}

describe("pingHandler", () => {
  test("all CLIs found → all ✓", async () => {
    const result = await pingHandler({
      agy: `${F}/fake-agy.sh`,
      kilo: `${F}/fake-kilo.sh`,
      opencode: `${F}/fake-opencode.sh`,
      codex: `${F}/fake-codex.sh`,
      hermes: `${F}/fake-hermes.sh`,
      workspaceRoot: "/tmp",
    });
    const out = text(result);
    expect(out).toContain("✓ agy: 1.0.0");
    expect(out).toContain("✓ kilo: 7.2.14");
    expect(out).toContain("✓ opencode: 1.14.18");
    expect(out).toContain("✓ codex: codex-cli 0.130.0");
    expect(out).toContain("✓ hermes: Hermes Agent v0.10.0");
  }, 10_000);

  test("missing binary → ✗ for that CLI, rest unaffected", async () => {
    const result = await pingHandler({
      agy: `${F}/fake-agy.sh`,
      kilo: "/nonexistent/kilo",
      opencode: `${F}/fake-opencode.sh`,
      codex: `${F}/fake-codex.sh`,
      hermes: `${F}/fake-hermes.sh`,
      workspaceRoot: "/tmp",
    });
    const out = text(result);
    expect(out).toContain("✓ agy");
    expect(out).toContain("✗ kilo");
    expect(out).toContain("✓ opencode");
  }, 10_000);

  test("all missing → all ✗, result is not isError", async () => {
    const result = await pingHandler({
      agy: "/nonexistent/agy",
      kilo: "/nonexistent/kilo",
      opencode: "/nonexistent/opencode",
      codex: "/nonexistent/codex",
      hermes: "/nonexistent/hermes",
      workspaceRoot: "/tmp",
    });
    expect(result.isError).toBeUndefined();
    const out = text(result);
    expect(out).toContain("✗ agy");
    expect(out).toContain("✗ kilo");
    expect(out).toContain("✗ opencode");
    expect(out).toContain("✗ codex");
    expect(out).toContain("✗ hermes");
  }, 10_000);

  test("binary exists but version exits non-zero → 'check failed' not 'not found'", async () => {
    const result = await pingHandler({
      agy: "/usr/bin/false",
      kilo: `${F}/fake-kilo.sh`,
      opencode: `${F}/fake-opencode.sh`,
      codex: `${F}/fake-codex.sh`,
      hermes: `${F}/fake-hermes.sh`,
      workspaceRoot: "/tmp",
    });
    const out = text(result);
    expect(out).toContain("✗ agy");
    expect(out).not.toContain("not found");
    expect(out).toContain("check failed");
  }, 10_000);

  test("version exits non-zero with stderr → check failed includes stderr output", async () => {
    const result = await pingHandler({
      agy: `${F}/fake-agy.sh`,
      kilo: `${F}/fake-kilo-version-error.sh`,
      opencode: `${F}/fake-opencode.sh`,
      codex: `${F}/fake-codex.sh`,
      hermes: `${F}/fake-hermes.sh`,
      workspaceRoot: "/tmp",
    });
    const out = text(result);
    expect(out).toContain("✗ kilo");
    expect(out).toContain("kilo version check failed");
  }, 10_000);

  test("includes workspace root", async () => {
    const result = await pingHandler({
      agy: `${F}/fake-agy.sh`,
      kilo: `${F}/fake-kilo.sh`,
      opencode: `${F}/fake-opencode.sh`,
      codex: `${F}/fake-codex.sh`,
      hermes: `${F}/fake-hermes.sh`,
      workspaceRoot: "/my/workspace",
    });
    expect(text(result)).toContain("workspace root: /my/workspace");
  }, 10_000);
});
