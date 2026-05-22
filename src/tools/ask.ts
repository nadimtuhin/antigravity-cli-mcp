import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { runCli, CliTimeoutError, mcpText, mcpError, makeProgressEmitter } from "mcp-cli-core";

interface AskInput {
  prompt: string;
  cwd?: string;
  timeout_ms?: number;
  add_dirs?: string[];
  skip_permissions?: boolean;
}

interface AskConfig {
  agyCmdPath: string;
  timeoutMs: number;
  workspaceRoot: string;
  maxConcurrent: number;
}

export type McpExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

export function buildAgyArgs(prompt: string, opts: Partial<AskInput>): string[] {
  const args = ["--print", prompt];
  if (opts.timeout_ms) {
    const seconds = Math.floor(opts.timeout_ms / 1000);
    args.push("--print-timeout", `${seconds}s`);
  }
  const extraDirs: string[] = [];
  if (opts.cwd && !opts.add_dirs?.includes(opts.cwd)) {
    extraDirs.push(opts.cwd);
  }
  for (const dir of [...extraDirs, ...(opts.add_dirs ?? [])]) {
    args.push("--add-dir", dir);
  }
  if (opts.skip_permissions === true) {
    args.push("--dangerously-skip-permissions");
  }
  return args;
}

export async function askHandler(
  input: AskInput,
  config: AskConfig,
  extra?: McpExtra
): Promise<CallToolResult> {
  const args = buildAgyArgs(input.prompt, input);
  const timeoutMs = input.timeout_ms ?? config.timeoutMs;

  const progressToken = extra?._meta?.progressToken;
  const progressEmitter = extra
    ? makeProgressEmitter(progressToken, (n) => extra.sendNotification(n as Parameters<typeof extra.sendNotification>[0]))
    : null;

  function onChunk(chunk: string): void {
    console.error(`[agy] ${chunk.trimEnd()}`);
    if (progressEmitter) {
      progressEmitter(chunk).catch(() => {});
    }
  }

  try {
    const result = await runCli(args, {
      cliCmdPath: config.agyCmdPath,
      cwd: input.cwd ?? config.workspaceRoot,
      timeoutMs,
      maxConcurrent: config.maxConcurrent,
      onChunk,
    });
    return mcpText(result.stdout);
  } catch (e) {
    if (e instanceof CliTimeoutError) {
      return mcpError(`agy timed out after ${timeoutMs}ms`);
    }
    const message = e instanceof Error ? e.message : String(e);
    return mcpError(message);
  }
}
