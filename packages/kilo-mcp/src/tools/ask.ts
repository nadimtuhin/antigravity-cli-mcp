import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  runCli,
  CliTimeoutError,
  CliExitError,
  mcpText,
  mcpError,
  makeProgressEmitter,
} from "mcp-cli-core";

export interface AskInput {
  prompt: string;
  cwd?: string;
  timeout_ms?: number;
  model?: string;
}

export interface AskConfig {
  cliCmdPath: string;
  timeoutMs: number;
  workspaceRoot: string;
  maxConcurrent: number;
  debug: boolean;
}

export type McpExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

export function buildArgs(prompt: string, opts: Partial<AskInput> = {}): string[] {
  const args = ["run", prompt];
  if (opts.model) args.push("--model", opts.model);
  return args;
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
  const args = buildArgs(input.prompt, input);
  const timeoutMs = input.timeout_ms ?? config.timeoutMs;
  const emit = makeProgressEmit(extra);

  function onChunk(chunk: string): void {
    if (config.debug) console.error(`[kilo-mcp] ${chunk.trimEnd()}`);
    if (emit) emit(chunk);
  }

  try {
    const result = await runCli(args, {
      cliCmdPath: config.cliCmdPath,
      cwd: input.cwd ?? config.workspaceRoot,
      timeoutMs,
      maxConcurrent: config.maxConcurrent,
      debug: config.debug,
      debugPrefix: "[kilo-mcp]",
      onChunk,
    });
    return mcpText(result.stdout);
  } catch (e) {
    if (e instanceof CliTimeoutError) return mcpError(`kilo timed out after ${timeoutMs}ms`);
    if (e instanceof CliExitError) {
      const out = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
      return mcpError(out || `kilo exited with code ${e.exitCode}`);
    }
    return mcpError(e instanceof Error ? e.message : String(e));
  }
}
