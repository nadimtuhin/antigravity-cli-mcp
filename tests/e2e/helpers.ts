import type { Subprocess } from "bun";

interface JsonRpcRequest {
  method: string;
  params: Record<string, unknown>;
  id?: number;
}

interface JsonRpcResponse {
  id: number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

let nextId = 1;

export async function sendJsonRpc(
  proc: Subprocess<"pipe", "pipe", "pipe">,
  request: JsonRpcRequest,
  timeoutMs = 10_000
): Promise<JsonRpcResponse> {
  const id = request.id ?? nextId++;
  const message = JSON.stringify({ jsonrpc: "2.0", id, ...request });
  const writer = proc.stdin;
  writer.write(message + "\n");
  await writer.flush();

  return readJsonRpcResponse(proc, id, timeoutMs);
}

export async function sendNotification(
  proc: Subprocess<"pipe", "pipe", "pipe">,
  method: string,
  params: Record<string, unknown> = {}
): Promise<void> {
  const message = JSON.stringify({ jsonrpc: "2.0", method, params });
  const writer = proc.stdin;
  writer.write(message + "\n");
  await writer.flush();
}

async function readJsonRpcResponse(
  proc: Subprocess<"pipe", "pipe", "pipe">,
  targetId: number,
  timeoutMs: number
): Promise<JsonRpcResponse> {
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const readPromise = reader.read();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout reading after ${timeoutMs}ms`)), remaining)
    );

    const { done, value } = await Promise.race([readPromise, timeoutPromise]);
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as JsonRpcResponse;
        if (parsed.id === targetId) {
          reader.releaseLock();
          return parsed;
        }
      } catch {}
    }
  }

  reader.releaseLock();
  throw new Error(`No JSON-RPC response for id=${targetId} within ${timeoutMs}ms`);
}

const FAKE_AGY = import.meta.dir + "/../../test-fixtures/fake-agy.sh";
const SERVER_ENTRY = import.meta.dir + "/../../src/index.ts";

export function startServer(env: Record<string, string> = {}): Subprocess<"pipe", "pipe", "pipe"> {
  return Bun.spawn(["bun", SERVER_ENTRY], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, AGY_PATH: FAKE_AGY, ...env },
  });
}

export async function initializeMcp(proc: Subprocess<"pipe", "pipe", "pipe">): Promise<void> {
  await sendJsonRpc(proc, {
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "test-client", version: "0.0.1" },
      capabilities: {},
    },
  });
  await sendNotification(proc, "notifications/initialized");
}
