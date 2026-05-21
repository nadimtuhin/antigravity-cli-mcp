import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { mkdir, access } from "fs/promises";
import { dirname } from "path";
import { validatePath } from "../security.js";
import { AgyPathError } from "../types.js";
import { mcpText, mcpError } from "../types.js";

interface WriteInput {
  path: string;
  content: string;
  create_parents?: boolean;
}

export async function writeHandler(input: WriteInput, workspaceRoot: string): Promise<CallToolResult> {
  let resolvedPath: string;

  try {
    resolvedPath = await validatePath(input.path, workspaceRoot);
  } catch (e) {
    if (e instanceof AgyPathError) {
      return mcpError(e.message);
    }
    const message = e instanceof Error ? e.message : String(e);
    return mcpError(message);
  }

  const parentDir = dirname(resolvedPath);

  if (input.create_parents) {
    await mkdir(parentDir, { recursive: true });
  } else {
    try {
      await access(parentDir);
    } catch {
      return mcpError(`Parent directory does not exist: ${parentDir}`);
    }
  }

  try {
    await Bun.write(resolvedPath, input.content);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return mcpError(`Write failed: ${message}`);
  }

  const byteCount = new TextEncoder().encode(input.content).byteLength;
  return mcpText(`Written ${byteCount} bytes to ${resolvedPath}`);
}
