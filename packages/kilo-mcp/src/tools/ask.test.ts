import { describe, test, expect } from "bun:test";
import { askHandler, type AskConfig, type McpExtra } from "./ask.js";

const F = import.meta.dir + "/../../test-fixtures";

const config: AskConfig = {
  cliCmdPath: `${F}/fake-kilo.sh`,
  timeoutMs: 10_000,
  workspaceRoot: "/tmp",
  maxConcurrent: 5,
  debug: false,
};

function text(result: Awaited<ReturnType<typeof askHandler>>): string {
  const item = result.content[0];
  if (item.type !== "text") throw new Error("expected text content");
  return item.text;
}

describe("askHandler (kilo)", () => {
  test("basic prompt → run subcommand output", async () => {
    const result = await askHandler({ prompt: "hello" }, config);
    expect(result.isError).toBeUndefined();
    expect(text(result)).toContain("Hello from fake kilo: hello");
  }, 10_000);

  test("with model → --model flag in CLI args", async () => {
    const result = await askHandler({ prompt: "hello", model: "claude-sonnet" }, config);
    expect(result.isError).toBeUndefined();
    expect(text(result)).toContain("--model");
    expect(text(result)).toContain("claude-sonnet");
  }, 10_000);

  test("missing binary → isError with 'not found' message", async () => {
    const result = await askHandler(
      { prompt: "hello" },
      { ...config, cliCmdPath: "/nonexistent/kilo" }
    );
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("not found");
  }, 10_000);

  test("CLI exits non-zero → isError with stderr preserved", async () => {
    const result = await askHandler(
      { prompt: "hello" },
      { ...config, cliCmdPath: `${F}/fake-kilo-error.sh` }
    );
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("kilo internal failure");
  }, 10_000);

  test("concurrency limit exceeded → isError with concurrency message", async () => {
    const result = await askHandler({ prompt: "hello" }, { ...config, maxConcurrent: 0 });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/concurrent/i);
  }, 10_000);

  test("timeout → isError with timed out message", async () => {
    const result = await askHandler({ prompt: "hello", timeout_ms: 1 }, config);
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/timed out/i);
  }, 10_000);

  test("progress notifications emitted when extra has progressToken", async () => {
    const notifications: unknown[] = [];
    const mockExtra = {
      _meta: { progressToken: "tok-1" },
      sendNotification: async (n: unknown) => { notifications.push(n); },
    } as unknown as McpExtra;
    const result = await askHandler({ prompt: "hello" }, config, mockExtra);
    expect(result.isError).toBeUndefined();
    expect(notifications.length).toBeGreaterThan(0);
    const first = notifications[0] as { method: string; params: { progressToken: string } };
    expect(first.method).toBe("notifications/progress");
    expect(first.params.progressToken).toBe("tok-1");
  }, 10_000);
});
