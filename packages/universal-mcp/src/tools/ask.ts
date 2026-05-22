import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { runCli, CliTimeoutError, mcpText, mcpError, makeProgressEmitter } from "mcp-cli-core";

export type CliName = "agy" | "kilo" | "opencode" | "codex" | "hermes";

export interface AskInput {
  prompt: string;
  via: CliName;
  cwd?: string;
  timeout_ms?: number;
  model?: string;
  max_turns?: number;
  add_dirs?: string[];
  skip_permissions?: boolean;
}

export interface AskConfig {
  paths: Record<CliName, string>;
  timeoutMs: number;
  workspaceRoot: string;
  maxConcurrent: number;
  debug: boolean;
}

export type McpExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

export function buildArgs(prompt: string, via: CliName, opts: Partial<AskInput> = {}): string[] {
  switch (via) {
    case "agy": {
      const args = ["--print", prompt];
      const extraDirs: string[] = opts.cwd ? [opts.cwd] : [];
      for (const dir of [...new Set([...extraDirs, ...(opts.add_dirs ?? [])])]) {
        args.push("--add-dir", dir);
      }
      if (opts.timeout_ms) {
        const seconds = Math.floor(opts.timeout_ms / 1000);
        args.push("--print-timeout", `${seconds}s`);
      }
      if (opts.skip_permissions === true) args.push("--dangerously-skip-permissions");
      return args;
    }
    case "kilo":
    case "opencode": {
      const args = ["run", prompt];
      if (opts.model) args.push("--model", opts.model);
      return args;
    }
    case "codex": {
      const args = ["exec", prompt];
      if (opts.model) args.push("-c", `model="${opts.model}"`);
      return args;
    }
    case "hermes": {
      const args = ["chat", "-q", prompt, "-Q"];
      if (opts.model) args.push("--model", opts.model);
      if (opts.max_turns !== undefined) args.push("--max-turns", String(opts.max_turns));
      return args;
    }
    default: {
      const _: never = via;
      throw new Error(`unsupported via: ${via}`);
    }
  }
}

function makeProgressEmit(extra: McpExtra | undefined): ((chunk: string) => void) | null {
  if (!extra) return null;
  const emitter = makeProgressEmitter(extra._meta?.progressToken, (n) =>
    extra.sendNotification(n as Parameters<typeof extra.sendNotification>[0])
  );
  if (!emitter) return null;
  return (chunk: string) => { emitter(chunk).catch(() => {}); };
}

export async function askHandler(
  input: AskInput,
  config: AskConfig,
  extra?: McpExtra
): Promise<CallToolResult> {
  const args = buildArgs(input.prompt, input.via, input);
  const timeoutMs = input.timeout_ms ?? config.timeoutMs;
  const emit = makeProgressEmit(extra);

  function onChunk(chunk: string): void {
    if (config.debug) console.error(`[${input.via}-mcp] ${chunk.trimEnd()}`);
    if (emit) emit(chunk);
  }

  try {
    const result = await runCli(args, {
      cliCmdPath: config.paths[input.via],
      cwd: input.cwd ?? config.workspaceRoot,
      timeoutMs,
      maxConcurrent: config.maxConcurrent,
      debug: config.debug,
      debugPrefix: `[${input.via}-mcp]`,
      onChunk,
    });
    return mcpText(result.stdout);
  } catch (e) {
    if (e instanceof CliTimeoutError) return mcpError(`${input.via} timed out after ${timeoutMs}ms`);
    return mcpError(e instanceof Error ? e.message : String(e));
  }
}
