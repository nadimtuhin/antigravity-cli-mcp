import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeHandler } from "mcp-cli-core";
import {
  TIMEOUT_MS,
  SEARCH_TIMEOUT_MS,
  WORKSPACE_ROOT,
  MAX_CONCURRENT,
  DEBUG,
  AGY_PATH,
  KILO_PATH,
  OPENCODE_PATH,
  CODEX_PATH,
  HERMES_PATH,
} from "./config.js";
import { pingHandler } from "./tools/ping.js";
import { askHandler, type CliName } from "./tools/ask.js";
import { usageHandler } from "./tools/usage.js";
import { makeSubHandler, getResultHandler } from "./tools/subagent.js";

const server = new McpServer({ name: "universal-ai-cli-mcp", version: "1.0.3" });

const paths = {
  agy: AGY_PATH,
  kilo: KILO_PATH,
  opencode: OPENCODE_PATH,
  codex: CODEX_PATH,
  hermes: HERMES_PATH,
};

const askConfig = {
  paths,
  timeoutMs: TIMEOUT_MS,
  workspaceRoot: WORKSPACE_ROOT,
  maxConcurrent: MAX_CONCURRENT,
  debug: DEBUG,
};

const baseAskInput = {
  prompt: z.string().max(10_000).describe("The prompt to send"),
  cwd: z.string().optional().describe("Working directory override"),
  timeout_ms: z.number().int().min(1000).max(600_000).optional().describe("Timeout in ms"),
};

const agyAskInput = {
  ...baseAskInput,
  add_dirs: z.array(z.string()).max(10).optional().describe("Extra directories to add"),
  skip_permissions: z.boolean().optional().describe("Skip agy permission prompts"),
};

const anthropicModel = z.string().optional().describe("Model override (e.g. 'anthropic/claude-sonnet-4', 'anthropic/claude-opus-4-7')");
const openaiModel = z.string().optional().describe("Model override (e.g. 'o3', 'o4-mini')");
const maxTurns = z.number().int().min(1).max(200).optional().describe("Max tool-calling iterations");

type AskInput = { prompt: string; cwd?: string; timeout_ms?: number; model?: string; max_turns?: number; add_dirs?: string[]; skip_permissions?: boolean };
type McpExtra = Parameters<typeof askHandler>[2];

function makeAskHandler(via: CliName) {
  return (input: AskInput, extra: unknown) =>
    askHandler({ ...input, via }, askConfig, extra as McpExtra);
}

// ─── Health & usage ───────────────────────────────────────────────────────────

server.registerTool("ping", {
  description: "Check health and version of all AI CLI tools (agy, kilo, opencode, codex, hermes). Run this first to see which CLIs are installed before routing tasks.",
  inputSchema: {},
}, () => pingHandler({ ...paths, workspaceRoot: WORKSPACE_ROOT }));

server.registerTool("get-usage", {
  description: "Check token usage and cost statistics across all AI CLIs. Note: agy and codex do not track usage — check your provider dashboard for those.",
  inputSchema: {},
}, () => usageHandler(paths));

// ─── Blocking ask tools (wait for response) ───────────────────────────────────

server.registerTool("ask-agy", {
  description: "Ask agy (antigravity) a question or run a task. Best for: quick answers, web searches, single-turn Q&A. agy is fast and doesn't use credits.",
  inputSchema: agyAskInput,
}, makeAskHandler("agy"));

server.registerTool("ask-kilo", {
  description: "Ask kilo (kilocode) to write, edit, or reason about code. Best for: multi-step coding tasks, refactoring, code generation, git commits. Runs autonomously with file + shell access.",
  inputSchema: { ...baseAskInput, model: anthropicModel },
}, makeAskHandler("kilo"));

server.registerTool("ask-opencode", {
  description: "Ask opencode to write or edit code. Alternative to kilo — same use cases, different provider defaults. Use when kilo is unavailable or you want a second opinion.",
  inputSchema: { ...baseAskInput, model: anthropicModel },
}, makeAskHandler("opencode"));

server.registerTool("ask-codex", {
  description: "Ask OpenAI Codex CLI to write or edit code. Use for tasks where OpenAI models (o3, o4-mini) are preferred. Supports model override via the model param.",
  inputSchema: { ...baseAskInput, model: openaiModel },
}, makeAskHandler("codex"));

server.registerTool("ask-hermes", {
  description: "Ask hermes to complete a multi-step agentic task. Best for: complex workflows, long chains of tool calls. Supports max_turns to control depth.",
  inputSchema: { ...baseAskInput, model: anthropicModel, max_turns: maxTurns },
}, (input, extra) => makeAskHandler("hermes")(input, extra));

// ─── Background sub tools (non-blocking, use get-result to collect output) ────

server.registerTool("sub-agy", {
  description: "Run agy in the background. Returns a job ID immediately so Claude can do other work in parallel. Call get-result(job_id) to retrieve the output when ready.",
  inputSchema: agyAskInput,
}, makeSubHandler("agy", askConfig));

server.registerTool("sub-kilo", {
  description: "Run kilo in the background. Returns a job ID immediately. Best for: starting a long coding task while continuing other work. Call get-result(job_id) to collect output.",
  inputSchema: { ...baseAskInput, model: anthropicModel },
}, makeSubHandler("kilo", askConfig));

server.registerTool("sub-opencode", {
  description: "Run opencode in the background. Returns a job ID immediately. Call get-result(job_id) to retrieve output.",
  inputSchema: { ...baseAskInput, model: anthropicModel },
}, makeSubHandler("opencode", askConfig));

server.registerTool("sub-codex", {
  description: "Run codex in the background. Returns a job ID immediately. Call get-result(job_id) to retrieve output.",
  inputSchema: { ...baseAskInput, model: openaiModel },
}, makeSubHandler("codex", askConfig));

server.registerTool("sub-hermes", {
  description: "Run hermes in the background. Returns a job ID immediately. Call get-result(job_id) to retrieve output.",
  inputSchema: { ...baseAskInput, model: anthropicModel, max_turns: maxTurns },
}, makeSubHandler("hermes", askConfig));

server.registerTool("get-result", {
  description: "Get the output of a background sub-* job. Returns 'still running' if not done yet — call again to poll. Results expire 10 minutes after completion.",
  inputSchema: { job_id: z.string().describe("Job ID returned by sub-agy, sub-kilo, sub-opencode, sub-codex, or sub-hermes") },
}, (input) => getResultHandler(input.job_id));

// ─── Utility tools ────────────────────────────────────────────────────────────

server.registerTool("search-web", {
  description: "Search the web for current information. Returns an AI-generated summary. Use for: recent events, library docs, version lookups, anything requiring up-to-date knowledge.",
  inputSchema: {
    query: z.string().max(500).describe("The search query"),
  },
}, (input, extra) =>
  askHandler(
    { prompt: `Search the web for: ${input.query}`, via: "agy", timeout_ms: SEARCH_TIMEOUT_MS },
    askConfig,
    extra as McpExtra
  )
);

server.registerTool("write-file", {
  description: "Write exact content to a file within the workspace. Path must be relative or within the workspace root.",
  inputSchema: {
    path: z.string().describe("File path (relative to workspace root)"),
    content: z.string().max(500_000).describe("Exact content to write"),
    create_parents: z.boolean().default(false).describe("Create parent directories if missing"),
  },
}, (input) =>
  writeHandler({ path: input.path, content: input.content, create_parents: input.create_parents }, WORKSPACE_ROOT)
);

const transport = new StdioServerTransport();
await server.connect(transport);
