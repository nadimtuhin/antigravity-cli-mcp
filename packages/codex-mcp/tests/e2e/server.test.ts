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

describe("e2e: codex-cli-mcp server", () => {
  test("tools/list returns 4 tools", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, { method: "tools/list", params: {} });
    expect(resp.error).toBeUndefined();
    const names = (resp.result as { tools: { name: string }[] }).tools.map((t) => t.name);
    expect(names).toContain("ping");
    expect(names).toContain("ask-codex");
    expect(names).toContain("search-web");
    expect(names).toContain("write-file");
  }, 15_000);

  test("ping → codex version shown", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, { method: "tools/call", params: { name: "ping", arguments: {} } });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("codex-cli 0.130.0");
  }, 15_000);

  test("ping → missing binary → isError with 'not found'", async () => {
    server = startServer({ CODEX_PATH: "/nonexistent/codex" });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, { method: "tools/call", params: { name: "ping", arguments: {} } });
    const result = resp.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  }, 15_000);

  test("ping → binary exists but fails → isError with 'ping failed'", async () => {
    server = startServer({ CODEX_PATH: "/usr/bin/false" });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, { method: "tools/call", params: { name: "ping", arguments: {} } });
    const result = resp.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ping failed");
    expect(result.content[0].text).not.toContain("not found");
  }, 15_000);

  test("invalid CODEX_TIMEOUT_MS env var → server starts and responds normally (not NaN/0 timeout)", async () => {
    server = startServer({ CODEX_TIMEOUT_MS: "not-a-number" });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-codex", arguments: { prompt: "hello" } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Hello from fake codex: hello");
  }, 15_000);

  test("ask-codex returns fake codex response", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-codex", arguments: { prompt: "hello" } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Hello from fake codex: hello");
  }, 15_000);

  test("ask-codex missing binary → result isError (not JSON-RPC error)", async () => {
    server = startServer({ CODEX_PATH: "/nonexistent/codex" });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-codex", arguments: { prompt: "hello" } },
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { isError: boolean };
    expect(result.isError).toBe(true);
  }, 15_000);

  test("invalid CODEX_SEARCH_TIMEOUT_MS env var → search-web responds normally (not NaN/0 timeout)", async () => {
    server = startServer({ CODEX_SEARCH_TIMEOUT_MS: "not-a-number" });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "search-web", arguments: { query: "bun js" } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Search the web for: bun js");
  }, 15_000);

  test("search-web delegates to ask-codex", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "search-web", arguments: { query: "bun js" } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Search the web for: bun js");
  }, 15_000);

  test("search-web missing binary → result isError (not JSON-RPC error)", async () => {
    server = startServer({ CODEX_PATH: "/nonexistent/codex" });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "search-web", arguments: { query: "test query" } },
    });
    expect(resp.error).toBeUndefined();
    expect((resp.result as { isError: boolean }).isError).toBe(true);
  }, 15_000);

  test("write-file writes to workspace", async () => {
    const tmpDir = `/tmp/codex-mcp-test-${Date.now()}`;
    await Bun.write(`${tmpDir}/.keep`, "");
    server = startServer({ CODEX_WORKSPACE_ROOT: tmpDir });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "write-file", arguments: { path: "hello.txt", content: "world", create_parents: false } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Written");
    expect(await Bun.file(`${tmpDir}/hello.txt`).text()).toBe("world");
  }, 15_000);

  test("ask-codex CLI exits non-zero → isError with stderr preserved", async () => {
    server = startServer({ CODEX_PATH: `${F}/fake-codex-error.sh` });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-codex", arguments: { prompt: "hello" } },
    });
    const result = resp.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("codex internal failure");
  }, 15_000);

  test("ask-codex passes model as -c model= flag", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-codex", arguments: { prompt: "hello", model: "o3" } },
    });
    expect(resp.error).toBeUndefined();
    const out = toolText(resp);
    expect(out).toContain("-c");
    expect(out).toContain('model="o3"');
  }, 15_000);

  test("write-file absolute path outside workspace → isError", async () => {
    const tmpDir = `/tmp/codex-mcp-abspath-${Date.now()}`;
    await Bun.write(`${tmpDir}/.keep`, "");
    server = startServer({ CODEX_WORKSPACE_ROOT: tmpDir });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "write-file", arguments: { path: "/etc/passwd", content: "x", create_parents: false } },
    });
    const result = resp.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("escapes workspace");
  }, 15_000);

  test("write-file path traversal → isError", async () => {
    const tmpDir = `/tmp/codex-mcp-traversal-${Date.now()}`;
    await Bun.write(`${tmpDir}/.keep`, "");
    server = startServer({ CODEX_WORKSPACE_ROOT: tmpDir });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "write-file", arguments: { path: "../../etc/passwd", content: "x", create_parents: false } },
    });
    const result = resp.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("escapes workspace");
  }, 15_000);

  test("write-file create_parents=true creates parent dirs and writes file", async () => {
    const tmpDir = `/tmp/codex-mcp-parents-${Date.now()}`;
    await Bun.write(`${tmpDir}/.keep`, "");
    server = startServer({ CODEX_WORKSPACE_ROOT: tmpDir });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "write-file", arguments: { path: "new/sub/file.txt", content: "hello", create_parents: true } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Written");
    expect(await Bun.file(`${tmpDir}/new/sub/file.txt`).text()).toBe("hello");
  }, 15_000);

  test("write-file missing parent dir, create_parents=false → isError", async () => {
    const tmpDir = `/tmp/codex-mcp-noparent-${Date.now()}`;
    await Bun.write(`${tmpDir}/.keep`, "");
    server = startServer({ CODEX_WORKSPACE_ROOT: tmpDir });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "write-file", arguments: { path: "missing/sub/file.txt", content: "x", create_parents: false } },
    });
    expect((resp.result as { isError: boolean }).isError).toBe(true);
  }, 15_000);
});
