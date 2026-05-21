import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { runAgy } from "../runner.js";
import { AgyNotFoundError } from "../types.js";
import { mcpText, mcpError } from "../types.js";

interface PingConfig {
  agyCmdPath: string;
  workspaceRoot: string;
}

export async function pingHandler(config: PingConfig): Promise<CallToolResult> {
  try {
    const result = await runAgy(["--version"], { agyCmdPath: config.agyCmdPath });
    const version = result.stdout.trim();
    const text = [
      `agy version: ${version}`,
      `binary path: ${config.agyCmdPath}`,
      `executable: true`,
      `workspace root: ${config.workspaceRoot}`,
    ].join("\n");
    return mcpText(text);
  } catch (e) {
    if (e instanceof AgyNotFoundError) {
      return mcpError(`agy binary not found: ${config.agyCmdPath}`);
    }
    const message = e instanceof Error ? e.message : String(e);
    return mcpError(`ping failed: ${message}`);
  }
}
