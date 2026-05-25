import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { runCli, mcpText, CliNotFoundError, CliTimeoutError, CliExitError } from "mcp-cli-core";

interface CliSpec {
  name: string;
  path: string;
  versionArgs: string[];
}

async function checkCli(spec: CliSpec): Promise<string> {
  try {
    const result = await runCli(spec.versionArgs, {
      cliCmdPath: spec.path,
      timeoutMs: 5_000,
      maxConcurrent: 10,
    });
    return `✓ ${spec.name}: ${result.stdout.trim().split("\n")[0]}`;
  } catch (e) {
    if (e instanceof CliNotFoundError) return `✗ ${spec.name}: not found (${spec.path})`;
    if (e instanceof CliTimeoutError) return `✗ ${spec.name}: timed out`;
    if (e instanceof CliExitError) {
      const out = [e.stdout, e.stderr].filter(Boolean).join(" ").trim();
      return `✗ ${spec.name}: check failed${out ? ` — ${out}` : ""}`;
    }
    return `✗ ${spec.name}: check failed`;
  }
}

export async function pingHandler(paths: {
  agy: string;
  kilo: string;
  opencode: string;
  codex: string;
  hermes: string;
  workspaceRoot: string;
}): Promise<CallToolResult> {
  const specs: CliSpec[] = [
    { name: "agy", path: paths.agy, versionArgs: ["--version"] },
    { name: "kilo", path: paths.kilo, versionArgs: ["--version"] },
    { name: "opencode", path: paths.opencode, versionArgs: ["--version"] },
    { name: "codex", path: paths.codex, versionArgs: ["--version"] },
    { name: "hermes", path: paths.hermes, versionArgs: ["version"] },
  ];

  const results = await Promise.all(specs.map(checkCli));

  return mcpText(
    [
      "AI CLI status:",
      ...results,
      "",
      `workspace root: ${paths.workspaceRoot}`,
    ].join("\n")
  );
}
