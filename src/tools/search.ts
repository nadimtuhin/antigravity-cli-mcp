import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { askHandler, type McpExtra } from "./ask.js";

interface SearchInput {
  query: string;
}

interface SearchConfig {
  agyCmdPath: string;
  searchTimeoutMs: number;
  workspaceRoot: string;
  maxConcurrent: number;
}

export async function searchHandler(
  input: SearchInput,
  config: SearchConfig,
  extra?: McpExtra
): Promise<CallToolResult> {
  const prompt = `Search the web for: ${input.query}`;
  return askHandler(
    { prompt },
    {
      agyCmdPath: config.agyCmdPath,
      timeoutMs: config.searchTimeoutMs,
      workspaceRoot: config.workspaceRoot,
      maxConcurrent: config.maxConcurrent,
    },
    extra
  );
}
