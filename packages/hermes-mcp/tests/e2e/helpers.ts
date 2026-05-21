import type { Subprocess } from "bun";

const SERVER_ENTRY = import.meta.dir + "/../../src/index.ts";
const F = import.meta.dir + "/../../test-fixtures";

const FAKE_PATHS = { HERMES_PATH: `${F}/fake-hermes.sh` };

export function startServer(env: Record<string, string> = {}): Subprocess<"pipe", "pipe", "pipe"> {
  return Bun.spawn({
    cmd: ["bun", SERVER_ENTRY],
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...FAKE_PATHS, ...env },
  });
}

interface JsonRpcRequest { method: string; params: Record<string, unknown>; id?: number; }
interface JsonRpcResponse { id: number | null; result?: unknown; error?: { code: number; message: string }; }

let nextId = 1;

export async function sendJsonRpc(
  proc: Subprocess<"pipe", "pipe", "pipe">,
  request: JsonRpcRequest,
  timeoutMs = 10_000
): Promise<JsonRpcResponse> {
  const id = request.id ?? nextId++;
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, ...request }) + "\n");
  await proc.stdin.flush();
  return readResponse(proc, id, timeoutMs);
}

async function sendNotification(
  proc: Subprocess<"pipe", "pipe", "pipe">,
  method: string,
  params: Record<string, unknown> = {}
): Promise<void> {
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  await proc.stdin.flush();
}

async function readResponse(
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
    const { done, value } = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), remaining)
      ),
    ]);
    if (done) throw new Error("server stdout closed");
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as JsonRpcResponse;
        if (parsed.id === targetId) { reader.releaseLock(); return parsed; }
      } catch {}
    }
  }
  throw new Error(`no response for id=${targetId} within ${timeoutMs}ms`);
}

export async function initializeMcp(proc: Subprocess<"pipe", "pipe", "pipe">): Promise<void> {
  await sendJsonRpc(proc, {
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0" } },
  });
  await sendNotification(proc, "notifications/initialized");
}
