import { describe, test, expect, afterEach } from "bun:test";
import type { Subprocess } from "bun";

const FAKE_AGY = import.meta.dir + "/../../test-fixtures/fake-agy.sh";
const SLOW_AGY = import.meta.dir + "/../../test-fixtures/fake-agy-slow.sh";
const SERVER_ENTRY = import.meta.dir + "/../../src/index.ts";

function startServer(env: Record<string, string> = {}): Subprocess<"pipe", "pipe", "pipe"> {
  return Bun.spawn(["bun", SERVER_ENTRY], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });
}

async function collectMessages(
  proc: Subprocess<"pipe", "pipe", "pipe">,
  durationMs: number
): Promise<unknown[]> {
  const messages: unknown[] = [];
  const decoder = new TextDecoder();
  const reader = proc.stdout.getReader();
  let buffer = "";

  const deadline = Date.now() + durationMs;

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const readResult = reader.read();
    const timeout = new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), remaining));

    let done = false;
    let value: Uint8Array | undefined;
    try {
      const result = await Promise.race([readResult, timeout]);
      done = result.done ?? false;
      value = result.value;
    } catch {
      break;
    }

    if (done) break;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try { messages.push(JSON.parse(trimmed)); } catch {}
      }
    }
  }

  reader.releaseLock();
  return messages;
}

async function sendRaw(proc: Subprocess<"pipe", "pipe", "pipe">, obj: unknown): Promise<void> {
  proc.stdin.write(JSON.stringify(obj) + "\n");
  await proc.stdin.flush();
}

let server: Subprocess<"pipe", "pipe", "pipe"> | null = null;

afterEach(() => {
  if (server) { try { server.kill(); } catch {} server = null; }
});

describe("e2e: progress notifications", () => {
  test("ask-agy with progressToken emits notifications/progress", async () => {
    server = startServer({ AGY_PATH: SLOW_AGY });

    await sendRaw(server, {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", clientInfo: { name: "test", version: "0" }, capabilities: {} },
    });
    await sendRaw(server, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });

    await sendRaw(server, {
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: {
        name: "ask-agy",
        arguments: { prompt: "hello" },
        _meta: { progressToken: "test-progress-token" },
      },
    });

    const messages = await collectMessages(server, 8_000);

    const progressNotifications = messages.filter(
      (m) => (m as { method?: string }).method === "notifications/progress"
    );
    const toolResult = messages.find(
      (m) => (m as { id?: number }).id === 2 && !(m as { method?: string }).method
    );

    expect(progressNotifications.length).toBeGreaterThan(0);
    const first = progressNotifications[0] as {
      method: string;
      params: { progressToken: string; progress: number; message: string };
    };
    expect(first.params.progressToken).toBe("test-progress-token");
    expect(first.params.progress).toBeGreaterThanOrEqual(1);
    expect(typeof first.params.message).toBe("string");

    expect(toolResult).toBeDefined();
  }, 15_000);

  test("ask-agy without progressToken has no progress notifications", async () => {
    server = startServer({ AGY_PATH: FAKE_AGY });

    await sendRaw(server, {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", clientInfo: { name: "test", version: "0" }, capabilities: {} },
    });
    await sendRaw(server, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    await sendRaw(server, {
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "ask-agy", arguments: { prompt: "hello" } },
    });

    const messages = await collectMessages(server, 5_000);
    const progressNotifications = messages.filter(
      (m) => (m as { method?: string }).method === "notifications/progress"
    );
    expect(progressNotifications.length).toBe(0);
  }, 10_000);

  test("stderr receives direct output during ask-agy", async () => {
    server = startServer({ AGY_PATH: SLOW_AGY });

    await sendRaw(server, {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", clientInfo: { name: "test", version: "0" }, capabilities: {} },
    });
    await sendRaw(server, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    await sendRaw(server, {
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "ask-agy", arguments: { prompt: "hello" } },
    });

    const stderrChunks: string[] = [];
    const stderrReader = server.stderr.getReader();
    const decoder = new TextDecoder();
    const deadline = Date.now() + 8_000;

    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      let result: { done: boolean; value?: Uint8Array };
      try {
        result = await Promise.race([
          stderrReader.read(),
          new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), remaining)),
        ]);
      } catch { break; }
      if (result.done) break;
      if (result.value) stderrChunks.push(decoder.decode(result.value, { stream: true }));
      if (stderrChunks.join("").includes("[agy]")) break;
    }
    stderrReader.releaseLock();

    const stderrText = stderrChunks.join("");
    expect(stderrText).toContain("[agy]");
  }, 15_000);
});
