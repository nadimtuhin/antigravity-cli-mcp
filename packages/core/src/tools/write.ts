import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { mkdir, access } from "fs/promises";
import { dirname } from "path";
import { validatePath } from "../security.js";
import { CliPathError, mcpText, mcpError } from "../types.js";

export interface WriteInput {
  path: string;
  content: string;
  create_parents?: boolean;
}

export async function writeHandler(input: WriteInput, workspaceRoot: string): Promise<CallToolResult> {
  let resolvedPath: string;

  try {
    resolvedPath = await validatePath(input.path, workspaceRoot);
  } catch (e) {
    if (e instanceof CliPathError) {
      return mcpError(e.message);
    }
    const message = e instanceof Error ? e.message : String(e);
    return mcpError(message);
  }

  const parentDir = dirname(resolvedPath);

  if (input.create_parents) {
    try {
      await mkdir(parentDir, { recursive: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return mcpError(`Failed to create directories: ${message}`);
    }
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
