import { describe, test, expect, afterEach } from "bun:test";
import { startServer, initializeMcp, sendJsonRpc } from "./helpers.js";
import type { Subprocess } from "bun";

let server: Subprocess<"pipe", "pipe", "pipe"> | null = null;

afterEach(() => {
  if (server) {
    try { server.kill(); } catch {}
    server = null;
  }
});

describe("e2e: MCP server", () => {
  test("responds to tools/list with all 4 tools", async () => {
    server = startServer();
    await initializeMcp(server);

    const response = await sendJsonRpc(server, { method: "tools/list", params: {} });
    expect(response.error).toBeUndefined();

    const result = response.result as { tools: Array<{ name: string }> };
    const names = result.tools.map((t) => t.name);
    expect(names).toContain("ping");
    expect(names).toContain("ask-agy");
    expect(names).toContain("search-web");
    expect(names).toContain("write-file");
  }, 15_000);

  test("ping tool returns version info", async () => {
    server = startServer();
    await initializeMcp(server);

    const response = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ping", arguments: {} },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: Array<{ type: string; text: string }> };
    const text = result.content[0].text;
    expect(text).toContain("1.0.0");
    expect(text).toContain("executable: true");
  }, 15_000);

  test("ask-agy tool returns response", async () => {
    server = startServer();
    await initializeMcp(server);

    const response = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-agy", arguments: { prompt: "hello" } },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toContain("Hello from fake agy");
  }, 15_000);

  test("search-web tool prefixes query", async () => {
    server = startServer();
    await initializeMcp(server);

    const response = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "search-web", arguments: { query: "bun js" } },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toContain("Search the web for: bun js");
  }, 15_000);

  test("server produces no non-RPC stdout before handshake", async () => {
    server = startServer();
    const chunks: Uint8Array[] = [];
    const reader = server.stdout.getReader();

    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 500));
    const collectPromise = (async () => {
      while (true) {
        const readPromise = reader.read();
        const done = await Promise.race([
          readPromise.then(({ done, value }) => {
            if (value) chunks.push(value);
            return done;
          }),
          timeoutPromise.then(() => true),
        ]);
        if (done) break;
      }
    })();

    await timeoutPromise;
    reader.releaseLock();

    const raw = new TextDecoder().decode(
      chunks.reduce((a, b) => {
        const out = new Uint8Array(a.byteLength + b.byteLength);
        out.set(a); out.set(b, a.byteLength);
        return out;
      }, new Uint8Array())
    );
    expect(raw.trim()).toBe("");
  }, 5_000);

  test("write-file tool creates file in workspace", async () => {
    const { mkdtempSync, rmSync } = await import("fs");
    const { tmpdir } = await import("os");
    const ws = mkdtempSync(tmpdir() + "/agy-e2e-");

    try {
      server = startServer({ AGY_WORKSPACE_ROOT: ws });
      await initializeMcp(server);

      const response = await sendJsonRpc(server, {
        method: "tools/call",
        params: {
          name: "write-file",
          arguments: { path: "e2e-test.txt", content: "e2e content", create_parents: false },
        },
      });

      expect(response.error).toBeUndefined();
      const result = response.result as { content: Array<{ type: string; text: string }> };
      expect(result.content[0].text).toContain("Written");

      const text = await Bun.file(ws + "/e2e-test.txt").text();
      expect(text).toBe("e2e content");
    } finally {
      try { rmSync(ws, { recursive: true }); } catch {}
    }
  }, 15_000);

  test("ask-agy passes add_dirs as --add-dir flags", async () => {
    server = startServer();
    await initializeMcp(server);

    const response = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-agy", arguments: { prompt: "hello", add_dirs: ["/extra/dir"] } },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toContain("--add-dir");
    expect(result.content[0].text).toContain("/extra/dir");
  }, 15_000);

  test("ask-agy passes cwd as --add-dir flag", async () => {
    server = startServer();
    await initializeMcp(server);

    const response = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-agy", arguments: { prompt: "hello", cwd: "/tmp" } },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toContain("--add-dir");
    expect(result.content[0].text).toContain("/tmp");
  }, 15_000);

  test("ask-agy passes skip_permissions as --dangerously-skip-permissions", async () => {
    server = startServer();
    await initializeMcp(server);

    const response = await sendJsonRpc(server, {
      method: "tools/call",
      params: { name: "ask-agy", arguments: { prompt: "hello", skip_permissions: true } },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toContain("--dangerously-skip-permissions");
  }, 15_000);
});
