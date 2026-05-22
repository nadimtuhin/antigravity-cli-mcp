import { describe, test, expect, afterEach } from "bun:test";
import { startServer, initializeMcp, sendJsonRpc } from "./helpers.js";
import type { Subprocess } from "bun";

const F = import.meta.dir + "/../../test-fixtures";

let server: Subprocess<"pipe", "pipe", "pipe"> | null = null;

afterEach(() => {
  if (server) { try { server.kill(); } catch {} server = null; }
});

function toolText(response: Awaited<ReturnType<typeof sendJsonRpc>>): string {
  const result = response.result as { content: Array<{ type: string; text: string }> };
  return result.content[0].text;
}

describe("e2e: kilo-cli-mcp server", () => {
  test("tools/list returns 4 tools", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, { method: "tools/list", params: {} });
    expect(resp.error).toBeUndefined();
    const names = (resp.result as { tools: { name: string }[] }).tools.map((t) => t.name);
    expect(names).toContain("ping");
    expect(names).toContain("ask-kilo");
    expect(names).toContain("search-web");
    expect(names).toContain("write-file");
  }, 15_000);

  test("ping → kilo version shown", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, { method: "tools/call", params: { name: "ping", arguments: {} } });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("7.2.14");
  }, 15_000);

  test("ask-kilo returns fake kilo response", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-kilo", arguments: { prompt: "hello" } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Hello from fake kilo: hello");
  }, 15_000);

  test("search-web delegates to ask-kilo", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "search-web", arguments: { query: "bun js" } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Search the web for: bun js");
  }, 15_000);

  test("write-file writes to workspace", async () => {
    const tmpDir = `/tmp/kilo-mcp-test-${Date.now()}`;
    await Bun.write(`${tmpDir}/.keep`, "");
    server = startServer({ KILO_WORKSPACE_ROOT: tmpDir });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "write-file", arguments: { path: "hello.txt", content: "world", create_parents: false } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Written");
    expect(await Bun.file(`${tmpDir}/hello.txt`).text()).toBe("world");
  }, 15_000);

  test("ask-kilo passes model as --model flag", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-kilo", arguments: { prompt: "hello", model: "claude-sonnet" } },
    });
    expect(resp.error).toBeUndefined();
    const out = toolText(resp);
    expect(out).toContain("--model");
    expect(out).toContain("claude-sonnet");
  }, 15_000);

  test("write-file path traversal → isError", async () => {
    const tmpDir = `/tmp/kilo-mcp-traversal-${Date.now()}`;
    await Bun.write(`${tmpDir}/.keep`, "");
    server = startServer({ KILO_WORKSPACE_ROOT: tmpDir });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "write-file", arguments: { path: "../../etc/passwd", content: "x", create_parents: false } },
    });
    const result = resp.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("escapes workspace");
  }, 15_000);
});
