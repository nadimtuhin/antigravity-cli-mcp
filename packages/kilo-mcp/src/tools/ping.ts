import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { runCli, CliNotFoundError, CliExitError, CliTimeoutError, mcpText, mcpError } from "mcp-cli-core";

interface PingConfig {
  cliCmdPath: string;
  workspaceRoot: string;
  timeoutMs?: number;
}

export async function pingHandler(config: PingConfig): Promise<CallToolResult> {
  try {
    const result = await runCli(["--version"], { cliCmdPath: config.cliCmdPath, timeoutMs: config.timeoutMs ?? 10_000 });
    const version = result.stdout.trim();
    return mcpText(
      [
        `kilo version: ${version}`,
        `binary path: ${config.cliCmdPath}`,
        `executable: true`,
        `workspace root: ${config.workspaceRoot}`,
      ].join("\n")
    );
  } catch (e) {
    if (e instanceof CliNotFoundError) {
      return mcpError(`kilo binary not found: ${config.cliCmdPath}`);
    }
    if (e instanceof CliTimeoutError) {
      return mcpError(`ping failed: kilo version check timed out`);
    }
    if (e instanceof CliExitError) {
      const out = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
      return mcpError(`ping failed: ${out || `exited with code ${e.exitCode}`}`);
    }
    const message = e instanceof Error ? e.message : String(e);
    return mcpError(`ping failed: ${message}`);
  }
}
