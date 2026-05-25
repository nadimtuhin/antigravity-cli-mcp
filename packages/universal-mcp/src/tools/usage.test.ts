import { describe, test, expect } from "bun:test";
import { usageHandler, fetchStats } from "./usage.js";
import { CliTimeoutError } from "mcp-cli-core";

const F = import.meta.dir + "/../../test-fixtures";

const FAKES = {
  agy: `${F}/fake-agy.sh`,
  kilo: `${F}/fake-kilo.sh`,
  opencode: `${F}/fake-opencode.sh`,
  codex: `${F}/fake-codex.sh`,
  hermes: `${F}/fake-hermes.sh`,
};

function text(result: Awaited<ReturnType<typeof usageHandler>>): string {
  const item = result.content[0];
  if (item.type !== "text") throw new Error("expected text content");
  return item.text;
}

describe("usageHandler", () => {
  test("agy section always shows no-tracking notice", async () => {
    const result = await usageHandler(FAKES);
    const out = text(result);
    expect(out).toContain("═══ agy ═══");
    expect(out).toContain("No balance tracking");
  }, 10_000);

  test("codex section always shows no-tracking notice", async () => {
    const result = await usageHandler(FAKES);
    const out = text(result);
    expect(out).toContain("═══ codex ═══");
    expect(out).toContain("No balance tracking");
  }, 10_000);

  test("kilo stats rendered with free tier warning", async () => {
    const result = await usageHandler(FAKES);
    const out = text(result);
    expect(out).toContain("═══ kilo ═══");
    expect(out).toContain("Total Cost");
    expect(out).toContain("$0.00");
    expect(out).toContain("Free tier detected");
  }, 10_000);

  test("opencode stats rendered with free tier warning", async () => {
    const result = await usageHandler(FAKES);
    const out = text(result);
    expect(out).toContain("═══ opencode ═══");
    expect(out).toContain("Free tier detected");
  }, 10_000);

  test("hermes insights rendered", async () => {
    const result = await usageHandler(FAKES);
    const out = text(result);
    expect(out).toContain("═══ hermes ═══");
    expect(out).toContain("Total tokens");
  }, 10_000);

  test("kilo stats failure → exhausted error message", async () => {
    const result = await usageHandler({
      ...FAKES,
      kilo: `${F}/fake-kilo-exhausted.sh`,
    });
    const out = text(result);
    expect(out).toContain("═══ kilo ═══");
    expect(out).toContain("Free token limit likely exhausted");
  }, 10_000);

  test("missing binary → 'not installed' message, not 'exhausted', no free tier warning", async () => {
    const result = await usageHandler({
      ...FAKES,
      opencode: "/nonexistent/opencode",
    });
    const out = text(result);
    const opencodeSection = out.split("═══ opencode ═══")[1]?.split("═══")[0] ?? "";
    expect(opencodeSection).toContain("not installed");
    expect(opencodeSection).not.toContain("exhausted");
    expect(opencodeSection).not.toContain("Free tier detected");
  }, 10_000);

  test("CLI stats times out → 'timed out' message not 'exhausted'", async () => {
    const timeoutRunner = async () => {
      throw new CliTimeoutError("CLI timed out after 10000ms", "", "");
    };
    const result = await fetchStats("kilo", "/path/to/kilo", ["stats"], timeoutRunner);
    expect(result.ok).toBe(false);
    expect(result.output).toContain("timed out");
    expect(result.output).not.toContain("exhausted");
  });

  test("result is never isError — always returns text", async () => {
    const result = await usageHandler({
      ...FAKES,
      kilo: "/nonexistent/kilo",
      opencode: "/nonexistent/opencode",
      hermes: "/nonexistent/hermes",
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe("text");
  }, 10_000);
});
