import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { mcpText } from "mcp-cli-core";
import { askHandler, type AskConfig, type McpExtra, type CliName } from "./ask.js";

interface Job {
  status: "running" | "done" | "error";
  result?: string;
  error?: string;
  cli: CliName;
  startedAt: number;
  completedAt?: number;
}

const TTL_MS = 10 * 60 * 1000;
export const jobs = new Map<string, Job>();

export function cleanupExpired(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.completedAt !== undefined && now - job.completedAt > TTL_MS) {
      jobs.delete(id);
    }
  }
}

function newJobId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function makeSubHandler(via: CliName, config: AskConfig) {
  return (
    input: { prompt: string; cwd?: string; timeout_ms?: number; model?: string; max_turns?: number; add_dirs?: string[]; skip_permissions?: boolean },
    extra: unknown
  ): CallToolResult => {
    cleanupExpired();
    const id = newJobId();
    const startedAt = Date.now();
    jobs.set(id, { status: "running", cli: via, startedAt });

    askHandler({ ...input, via }, config, extra as McpExtra)
      .then((result) => {
        const text = (result.content[0] as { type: string; text: string }).text;
        if (result.isError) {
          jobs.set(id, { status: "error", error: text, cli: via, startedAt, completedAt: Date.now() });
        } else {
          jobs.set(id, { status: "done", result: text, cli: via, startedAt, completedAt: Date.now() });
        }
      })
      .catch((e: unknown) => {
        jobs.set(id, {
          status: "error",
          error: e instanceof Error ? e.message : String(e),
          cli: via,
          startedAt,
          completedAt: Date.now(),
        });
      });

    return mcpText(`Job ${id} started (${via}). Call get-result('${id}') to check progress.`);
  };
}

export function getResultHandler(jobId: string): CallToolResult {
  const job = jobs.get(jobId);
  if (!job) {
    return mcpText(`Job '${jobId}' not found. It may have expired (10min TTL) or the ID is wrong.`);
  }

  const elapsed = Math.round((Date.now() - job.startedAt) / 1000);

  if (job.status === "running") {
    return mcpText(`Job ${jobId} still running (${job.cli}, ${elapsed}s elapsed). Call get-result again.`);
  }
  if (job.status === "error") {
    jobs.delete(jobId);
    return mcpText(`Job ${jobId} failed (${job.cli}):\n${job.error}`);
  }
  jobs.delete(jobId);
  return mcpText(job.result ?? "");
}
