import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  AGY_PATH,
  AGY_TIMEOUT_MS,
  AGY_SEARCH_TIMEOUT_MS,
  AGY_WORKSPACE_ROOT,
  AGY_MAX_CONCURRENT,
} from "./config.js";
import { pingHandler } from "./tools/ping.js";
import { askHandler } from "./tools/ask.js";
import { searchHandler } from "./tools/search.js";
import { writeHandler } from "./tools/write.js";

const server = new McpServer({ name: "antigravity-cli-mcp", version: "1.0.0" });

const askConfig = {
  agyCmdPath: AGY_PATH,
  timeoutMs: AGY_TIMEOUT_MS,
  workspaceRoot: AGY_WORKSPACE_ROOT,
  maxConcurrent: AGY_MAX_CONCURRENT,
};

server.registerTool(
  "ping",
  {
    description: "Check agy health and version",
    inputSchema: {},
  },
  () => pingHandler({ agyCmdPath: AGY_PATH, workspaceRoot: AGY_WORKSPACE_ROOT })
);

server.registerTool(
  "ask-agy",
  {
    description: "Run a prompt with agy non-interactively. Results are AI-generated.",
    inputSchema: {
      prompt: z.string().max(10_000).describe("The prompt to send to agy"),
      cwd: z.string().optional().describe("Working directory override"),
      timeout_ms: z.number().int().min(1000).max(600_000).optional().describe("Timeout in ms"),
      add_dirs: z.array(z.string()).max(10).optional().describe("Extra directories to add"),
      skip_permissions: z.boolean().optional().describe("Skip agy permission prompts"),
    },
  },
  (input, extra) =>
    askHandler(
      {
        prompt: input.prompt,
        cwd: input.cwd,
        timeout_ms: input.timeout_ms,
        add_dirs: input.add_dirs,
        skip_permissions: input.skip_permissions,
      },
      askConfig,
      extra
    )
);

server.registerTool(
  "search-web",
  {
    description:
      "Search the web via agy. Results come from agy's AI + web access — not a deterministic search API.",
    inputSchema: {
      query: z.string().max(500).describe("The search query"),
    },
  },
  (input, extra) =>
    searchHandler(
      { query: input.query },
      {
        agyCmdPath: AGY_PATH,
        searchTimeoutMs: AGY_SEARCH_TIMEOUT_MS,
        workspaceRoot: AGY_WORKSPACE_ROOT,
        maxConcurrent: AGY_MAX_CONCURRENT,
      },
      extra
    )
);

server.registerTool(
  "write-file",
  {
    description:
      "Write exact content to a file within the workspace. Path must be relative or within the workspace root.",
    inputSchema: {
      path: z.string().describe("File path (relative to workspace root)"),
      content: z.string().max(500_000).describe("Exact content to write"),
      create_parents: z.boolean().default(false).describe("Create parent directories if missing"),
    },
  },
  (input) =>
    writeHandler(
      {
        path: input.path,
        content: input.content,
        create_parents: input.create_parents,
      },
      AGY_WORKSPACE_ROOT
    )
);

const transport = new StdioServerTransport();
await server.connect(transport);
