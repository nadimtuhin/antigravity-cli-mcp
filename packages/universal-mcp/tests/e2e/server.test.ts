import { describe, test, expect, afterEach } from "bun:test";
import { startServer, initializeMcp, sendJsonRpc } from "./helpers.js";
import type { Subprocess } from "bun";

const F = import.meta.dir + "/../../test-fixtures";

let server: Subprocess<"pipe", "pipe", "pipe"> | null = null;

afterEach(() => {
  if (server) {
    try { server.kill(); } catch {}
    server = null;
  }
});

function toolText(response: Awaited<ReturnType<typeof sendJsonRpc>>): string {
  const result = response.result as { content: Array<{ type: string; text: string }> };
  return result.content[0].text;
}

describe("e2e: universal MCP server", () => {
  test("tools/list returns all expected tools", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, { method: "tools/list", params: {} });
    expect(resp.error).toBeUndefined();
    const names = (resp.result as { tools: { name: string }[] }).tools.map((t) => t.name);
    expect(names).toContain("ping");
    expect(names).toContain("ask-agy");
    expect(names).toContain("ask-kilo");
    expect(names).toContain("ask-opencode");
    expect(names).toContain("ask-codex");
    expect(names).toContain("ask-hermes");
    expect(names).toContain("sub-agy");
    expect(names).toContain("sub-kilo");
    expect(names).toContain("sub-opencode");
    expect(names).toContain("sub-codex");
    expect(names).toContain("sub-hermes");
    expect(names).toContain("get-result");
    expect(names).toContain("search-web");
    expect(names).toContain("write-file");
    expect(names).toContain("get-usage");
  }, 15_000);

  test("ping → all 5 CLIs detected", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, { method: "tools/call", params: { name: "ping", arguments: {} } });
    expect(resp.error).toBeUndefined();
    const out = toolText(resp);
    expect(out).toContain("✓ agy");
    expect(out).toContain("✓ kilo");
    expect(out).toContain("✓ opencode");
    expect(out).toContain("✓ codex");
    expect(out).toContain("✓ hermes");
  }, 15_000);

  test("ask-agy returns fake agy response", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-agy", arguments: { prompt: "hello" } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Hello from fake agy: hello");
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

  test("ask-hermes returns fake hermes response", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-hermes", arguments: { prompt: "hello" } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Hello from fake hermes: hello");
  }, 15_000);

  test("search-web delegates to agy", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "search-web", arguments: { query: "bun js" } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Search the web for: bun js");
  }, 15_000);

  test("get-usage → agy and codex show no-tracking, kilo shows free tier warning", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "get-usage", arguments: {} },
    });
    expect(resp.error).toBeUndefined();
    const out = toolText(resp);
    expect(out).toContain("No balance tracking");
    expect(out).toContain("Free tier detected");
    expect(out).toContain("Total tokens");
  }, 15_000);

  test("get-usage with exhausted kilo → shows exhausted error", async () => {
    server = startServer({ KILO_PATH: `${F}/fake-kilo-exhausted.sh` });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "get-usage", arguments: {} },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Free token limit likely exhausted");
  }, 15_000);

  test("write-file writes to workspace", async () => {
    const tmpDir = `/tmp/universal-mcp-test-${Date.now()}`;
    await Bun.write(`${tmpDir}/.keep`, "");
    server = startServer({ AI_CLI_WORKSPACE_ROOT: tmpDir });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "write-file", arguments: { path: "hello.txt", content: "world", create_parents: false } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("Written");
    expect(await Bun.file(`${tmpDir}/hello.txt`).text()).toBe("world");
  }, 15_000);

  test("write-file path traversal → isError", async () => {
    const tmpDir = `/tmp/universal-mcp-traversal-${Date.now()}`;
    await Bun.write(`${tmpDir}/.keep`, "");
    server = startServer({ AI_CLI_WORKSPACE_ROOT: tmpDir });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "write-file", arguments: { path: "../../etc/passwd", content: "x", create_parents: false } },
    });
    const result = resp.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("escapes workspace");
  }, 15_000);

  test("write-file missing parent dir → isError", async () => {
    const tmpDir = `/tmp/universal-mcp-noparent-${Date.now()}`;
    await Bun.write(`${tmpDir}/.keep`, "");
    server = startServer({ AI_CLI_WORKSPACE_ROOT: tmpDir });
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "write-file", arguments: { path: "missing/sub/file.txt", content: "x", create_parents: false } },
    });
    expect((resp.result as { isError: boolean }).isError).toBe(true);
  }, 15_000);

  test("sub-kilo returns job ID immediately", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "sub-kilo", arguments: { prompt: "hello" } },
    });
    expect(resp.error).toBeUndefined();
    const text = toolText(resp);
    expect(text).toContain("started (kilo)");
    expect(text).toContain("get-result");
  }, 15_000);

  test("get-result retrieves sub-kilo output after completion", async () => {
    server = startServer();
    await initializeMcp(server);

    const subResp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "sub-kilo", arguments: { prompt: "hello" } },
    });
    const subText = toolText(subResp);
    const match = subText.match(/Job (\S+) started/);
    expect(match).toBeTruthy();
    const jobId = match![1];

    await new Promise((r) => setTimeout(r, 500));

    const resultResp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "get-result", arguments: { job_id: jobId } },
    });
    expect(resultResp.error).toBeUndefined();
    expect(toolText(resultResp)).toContain("Hello from fake kilo: hello");
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

  test("ask-codex passes model as -c model= flag", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-codex", arguments: { prompt: "hello", model: "o3" } },
    });
    expect(resp.error).toBeUndefined();
    const out = toolText(resp);
    expect(out).toContain('-c');
    expect(out).toContain('model="o3"');
  }, 15_000);

  test("sub-agy passes add_dirs to background job", async () => {
    server = startServer();
    await initializeMcp(server);
    const subResp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "sub-agy", arguments: { prompt: "hello", add_dirs: ["/extra"] } },
    });
    const subText = toolText(subResp);
    const match = subText.match(/Job (\S+) started/);
    expect(match).toBeTruthy();
    const jobId = match![1];

    await new Promise((r) => setTimeout(r, 500));

    const resultResp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "get-result", arguments: { job_id: jobId } },
    });
    expect(resultResp.error).toBeUndefined();
    const out = toolText(resultResp);
    expect(out).toContain("--add-dir");
    expect(out).toContain("/extra");
  }, 15_000);

  test("ask-opencode passes model as --model flag", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-opencode", arguments: { prompt: "hello", model: "gpt-4o" } },
    });
    expect(resp.error).toBeUndefined();
    const out = toolText(resp);
    expect(out).toContain("--model");
    expect(out).toContain("gpt-4o");
  }, 15_000);

  test("ask-hermes passes model as --model flag", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-hermes", arguments: { prompt: "hello", model: "MiniMax" } },
    });
    expect(resp.error).toBeUndefined();
    const out = toolText(resp);
    expect(out).toContain("--model");
    expect(out).toContain("MiniMax");
  }, 15_000);

  test("ask-hermes passes max_turns as --max-turns flag", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-hermes", arguments: { prompt: "hello", max_turns: 3 } },
    });
    expect(resp.error).toBeUndefined();
    const out = toolText(resp);
    expect(out).toContain("--max-turns");
    expect(out).toContain("3");
  }, 15_000);

  test("ask-agy passes timeout_ms as --print-timeout flag", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-agy", arguments: { prompt: "hello", timeout_ms: 5000 } },
    });
    expect(resp.error).toBeUndefined();
    const out = toolText(resp);
    expect(out).toContain("--print-timeout");
    expect(out).toContain("5s");
  }, 15_000);

  test("sub-agy passes skip_permissions to background job", async () => {
    server = startServer();
    await initializeMcp(server);
    const subResp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "sub-agy", arguments: { prompt: "hello", skip_permissions: true } },
    });
    const subText = toolText(subResp);
    const match = subText.match(/Job (\S+) started/);
    expect(match).toBeTruthy();
    const jobId = match![1];

    await new Promise((r) => setTimeout(r, 500));

    const resultResp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "get-result", arguments: { job_id: jobId } },
    });
    expect(resultResp.error).toBeUndefined();
    expect(toolText(resultResp)).toContain("--dangerously-skip-permissions");
  }, 15_000);
  test("get-result unknown job → not found message", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "get-result", arguments: { job_id: "nonexistent" } },
    });
    expect(resp.error).toBeUndefined();
    expect(toolText(resp)).toContain("not found");
  }, 15_000);

  test("ask-agy passes cwd as --add-dir flag", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-agy", arguments: { prompt: "hello", cwd: "/tmp" } },
    });
    expect(resp.error).toBeUndefined();
    const out = toolText(resp);
    expect(out).toContain("--add-dir");
    expect(out).toContain("/tmp");
  }, 15_000);

  test("ask-agy passes add_dirs as --add-dir flags", async () => {
    server = startServer();
    await initializeMcp(server);
    const resp = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-agy", arguments: { prompt: "hello", add_dirs: ["/extra/dir"] } },
    });
    expect(resp.error).toBeUndefined();
    const out = toolText(resp);
    expect(out).toContain("--add-dir");
    expect(out).toContain("/extra/dir");
  }, 15_000);
});
