import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function mcpText(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

export function mcpError(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

export interface RunAgyOptions {
  cwd?: string;
  timeoutMs?: number;
  addDirs?: string[];
  env?: Record<string, string>;
}

export interface RunAgyResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export class AgyNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgyNotFoundError";
  }
}

export class AgyTimeoutError extends Error {
  stdout: string;
  stderr: string;
  constructor(message: string, stdout: string, stderr: string) {
    super(message);
    this.name = "AgyTimeoutError";
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

export class AgyExitError extends Error {
  exitCode: number;
  stdout: string;
  stderr: string;
  constructor(message: string, exitCode: number, stdout: string, stderr: string) {
    super(message);
    this.name = "AgyExitError";
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

export class AgyConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgyConcurrencyError";
  }
}

export class AgyPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgyPathError";
  }
}
