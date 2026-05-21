import {
  AgyNotFoundError,
  AgyTimeoutError,
  AgyExitError,
  AgyConcurrencyError,
  type RunAgyResult,
} from "./types.js";
import { AGY_MAX_CONCURRENT, AGY_MAX_OUTPUT_BYTES } from "./config.js";
import { AGY_DEBUG } from "./config.js";

interface RunAgyOpts {
  agyCmdPath: string;
  cwd?: string;
  timeoutMs?: number;
  maxConcurrent?: number;
  maxOutputBytes?: number;
  onChunk?: (chunk: string) => void;
}

let activeCount = 0;

export async function runAgy(args: string[], opts: RunAgyOpts): Promise<RunAgyResult> {
  const limit = opts.maxConcurrent ?? AGY_MAX_CONCURRENT;
  const maxBytes = opts.maxOutputBytes ?? AGY_MAX_OUTPUT_BYTES;

  activeCount++;
  if (activeCount > limit) {
    activeCount--;
    throw new AgyConcurrencyError(`Max concurrent agy processes (${limit}) exceeded`);
  }

  let proc: ReturnType<typeof Bun.spawn> | null = null;
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let killHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    try {
      proc = Bun.spawn({
        cmd: [opts.agyCmdPath, ...args],
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        cwd: opts.cwd,
      });
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "ENOENT") {
        throw new AgyNotFoundError(`agy binary not found: ${opts.agyCmdPath}`);
      }
      throw e;
    }

    if (opts.timeoutMs !== undefined) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        try { proc!.kill("SIGTERM"); } catch {}
        killHandle = setTimeout(() => {
          try { proc!.kill("SIGKILL"); } catch {}
        }, 5_000);
      }, opts.timeoutMs);
    }

    const stdoutChunks: Uint8Array[] = [];
    const stderrChunks: Uint8Array[] = [];
    let totalBytes = 0;
    let capped = false;

    const decoder = new TextDecoder();

    async function readStream(
      stream: ReadableStream<Uint8Array>,
      chunks: Uint8Array[],
      isStdout: boolean
    ) {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          if (!capped && totalBytes + value.byteLength <= maxBytes) {
            chunks.push(value);
            totalBytes += value.byteLength;
            if (isStdout && opts.onChunk) {
              const text = decoder.decode(value, { stream: true });
              opts.onChunk(text);
            }
          } else if (!capped) {
            const remaining = maxBytes - totalBytes;
            if (remaining > 0) {
              const slice = value.slice(0, remaining);
              chunks.push(slice);
              if (isStdout && opts.onChunk) {
                opts.onChunk(decoder.decode(slice, { stream: true }));
              }
            }
            capped = true;
            try { proc!.kill("SIGTERM"); } catch {}
          }
        }
      }
    }

    await Promise.all([
      readStream(proc.stdout as ReadableStream<Uint8Array>, stdoutChunks, true),
      readStream(proc.stderr as ReadableStream<Uint8Array>, stderrChunks, false),
    ]);

    const exitCode = await proc.exited;

    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    if (killHandle !== null) clearTimeout(killHandle);

    const stdoutBuf = new Uint8Array(stdoutChunks.reduce((acc, c) => acc + c.byteLength, 0));
    let offset = 0;
    for (const chunk of stdoutChunks) { stdoutBuf.set(chunk, offset); offset += chunk.byteLength; }
    const stderrBuf = new Uint8Array(stderrChunks.reduce((acc, c) => acc + c.byteLength, 0));
    offset = 0;
    for (const chunk of stderrChunks) { stderrBuf.set(chunk, offset); offset += chunk.byteLength; }
    const stdout = decoder.decode(stdoutBuf);
    const stderr = decoder.decode(stderrBuf);

    if (capped) {
      if (AGY_DEBUG) {
        console.error(`[antigravity-mcp] output capped at ${maxBytes} bytes`);
      }
    }

    if (timedOut) {
      throw new AgyTimeoutError(`agy timed out after ${opts.timeoutMs}ms`, stdout, stderr);
    }

    if (AGY_DEBUG && stderr) {
      console.error(`[antigravity-mcp] [stderr] ${stderr.slice(0, 200)}`);
    }

    if (exitCode !== 0) {
      throw new AgyExitError(`agy exited with code ${exitCode}`, exitCode, stdout, stderr);
    }

    return { stdout, stderr, exitCode, timedOut: false };
  } finally {
    activeCount--;
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    if (killHandle !== null) clearTimeout(killHandle);
  }
}
