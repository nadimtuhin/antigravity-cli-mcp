# antigravity MCP Server — Design Spec

**Date**: 2026-05-21  
**Status**: Approved (revised after Perplexity + Codex review)

---

## Context

`agy` (antigravity CLI) is at `/Users/nadimtuhin/.local/bin/agy`, v1.0.0 (Go TUI binary).  
`agy --print` / `agy -p` provides headless non-interactive mode — no PTY needed.  
Goal: expose `agy` to MCP clients (Claude Code, Cursor) via a Bun+TypeScript MCP server.

**Critical constraint**: stdio MCP servers must NEVER write to stdout except JSON-RPC messages.  
All logging must go to stderr via `console.error()`.

---

## V1 Scope (intentionally narrow)

Tools shipped in v1:
1. `ping` — health + readiness check
2. `ask-agy` — primary general-purpose prompt tool
3. `search-web` — prompt wrapper with clear "agy-backed" semantics
4. `write-file` — **exact mode only** (Bun.write, no agy involvement)

Deferred to v2:
- `write-file` instruct mode (too ambiguous — output parsing, path enforcement)
- `propose-file-edit` returning a diff

---

## Tech Stack

- **Runtime**: Bun + TypeScript + ESM (`"type": "module"`)
- **MCP SDK**: `@modelcontextprotocol/sdk` (latest)
- **Schema validation**: `zod`
- **Transport**: `StdioServerTransport`
- **Subprocess**: `Bun.spawn()` (argv array only — no shell)

---

## Project Structure

```
antigravity-cli-mcp/
├── src/
│   ├── index.ts          # Server bootstrap, tool registration
│   ├── runner.ts         # runAgy() — subprocess management
│   ├── config.ts         # Env-based config
│   ├── types.ts          # Shared types + typed errors
│   ├── security.ts       # realpath containment, path validation
│   └── tools/
│       ├── ping.ts
│       ├── ask.ts
│       ├── search.ts
│       └── write.ts
├── package.json
├── tsconfig.json
└── bunfig.toml
```

---

## Config (`src/config.ts`)

```ts
AGY_PATH              // default: "/Users/nadimtuhin/.local/bin/agy"
AGY_TIMEOUT_MS        // default: 300_000
AGY_SEARCH_TIMEOUT_MS // default: 60_000
AGY_WORKSPACE_ROOT    // default: process.cwd()
AGY_MAX_CONCURRENT    // default: 3
AGY_DEBUG             // "1" enables stderr debug logging
AGY_MAX_OUTPUT_BYTES  // default: 1_000_000 (1MB)
```

---

## Types (`src/types.ts`)

```ts
interface RunAgyOptions {
  cwd?: string;
  timeoutMs?: number;
  addDirs?: string[];
  env?: Record<string, string>;
}

interface RunAgyResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

// Typed errors
class AgyNotFoundError extends Error {}
class AgyTimeoutError extends Error { stdout: string; stderr: string }
class AgyExitError extends Error { exitCode: number; stdout: string; stderr: string }
class AgyConcurrencyError extends Error {}
class AgyPathError extends Error {}
```

---

## Security (`src/security.ts`)

```ts
function validatePath(inputPath: string, workspaceRoot: string): string
```
- Resolve `inputPath` relative to `workspaceRoot` using `Bun.resolve` / `path.resolve`
- Call `realpath()` equivalent to follow symlinks
- Confirm resolved path starts with `workspaceRoot`
- Throw `AgyPathError` if not contained
- Deny absolute paths that escape workspace
- No shell, no glob expansion

---

## Runner (`src/runner.ts`)

```ts
async function runAgy(args: string[], opts?: RunAgyOptions): Promise<RunAgyResult>
```

Spawn:
```ts
Bun.spawn({
  cmd: [AGY_PATH, ...args],  // argv array, no shell
  stdin: "ignore",
  stdout: "pipe",
  stderr: "pipe",
  cwd: opts?.cwd ?? AGY_WORKSPACE_ROOT,
  timeout: opts?.timeoutMs,
})
```

Process lifecycle:
1. Check `AGY_MAX_CONCURRENT` — throw `AgyConcurrencyError` if exceeded
2. Register process in active set
3. On timeout: send SIGTERM, wait 5s grace, then SIGKILL
4. Cap output at `AGY_MAX_OUTPUT_BYTES` — truncate with notice
5. Deregister from active set in `finally`

Returns `RunAgyResult` (stdout/stderr separate).  
Throws: `AgyNotFoundError`, `AgyTimeoutError`, `AgyExitError`, `AgyConcurrencyError`.

---

## MCP Tools

All tools return `{ content: [{ type: "text", text }], isError?: true }`.

### `ping`
Command: `agy --version`  
Returns structured health info:
```
agy version: 1.0.0
binary path: /Users/nadimtuhin/.local/bin/agy
executable: true
workspace root: /path/to/cwd
```
Plus basic readiness indicators (exit 0 = CLI available).

---

### `ask-agy`
Input schema (zod):
```ts
{
  prompt: z.string().max(10_000),
  cwd: z.string().optional(),
  timeout_ms: z.number().int().min(1000).max(600_000).optional(),
  add_dirs: z.array(z.string()).max(10).optional(),
  skip_permissions: z.boolean().optional(),
}
```
Command: `agy --print "<prompt>" [--print-timeout Xs] [--add-dir <d>]... [--dangerously-skip-permissions]`  
Returns: stdout text as MCP content. Stderr logged to `console.error`.

---

### `search-web`
Thin wrapper over `ask-agy`. Prompt prefix: `"Search the web for: "`.  
Shorter timeout: `AGY_SEARCH_TIMEOUT_MS`.  
Description explicitly states: "Results come from agy's AI + web access — not a deterministic search API."

Input:
```ts
{ query: z.string().max(500) }
```

---

### `write-file` (exact mode only)
Input:
```ts
{
  path: z.string(),
  content: z.string().max(500_000),
  create_parents: z.boolean().default(false),
}
```

Steps:
1. Validate path via `security.validatePath(path, AGY_WORKSPACE_ROOT)`
2. Optionally create parent dirs if `create_parents: true`
3. `Bun.write(resolvedPath, content)` — atomic temp+rename not in v1, but documented
4. Return: `"Written N bytes to <resolvedPath>"`

No `agy` invocation. No instruct mode in v1.

---

## Server (`src/index.ts`)

```ts
const server = new McpServer({ name: "antigravity-cli-mcp", version: "1.0.0" });
server.tool("ping", {}, pingHandler);
server.tool("ask-agy", askSchema, askHandler);
server.tool("search-web", searchSchema, searchHandler);
server.tool("write-file", writeSchema, writeHandler);
const transport = new StdioServerTransport();
await server.connect(transport);
```

All handlers:
- Catch typed errors → return `{ content: [...], isError: true }`
- `console.error()` for diagnostics (never `console.log`)
- No unhandled promise rejections

---

## Security Model

- Binary invoked as argv array, no shell
- `AGY_PATH` must be absolute — validated at startup
- `write-file` paths confined to `AGY_WORKSPACE_ROOT` via realpath
- Prompt/content size limits enforced by zod
- No env var passthrough to `agy` beyond what's in config
- Secrets (API keys) not logged even in debug mode
- `--dangerously-skip-permissions` only when explicitly requested by caller

---

## Logging Strategy

- `console.error()` for all diagnostics (goes to stderr)
- `AGY_DEBUG=1` enables verbose subprocess logging
- Never log full prompt content (may contain secrets)
- Structured format: `[antigravity-mcp] [level] message`

---

## Packaging

```json
{
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --target bun --outfile dist/index.js",
    "start": "bun run dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "bin": { "antigravity-cli-mcp": "./dist/index.js" }
}
```

Registration (dev): `claude mcp add antigravity -- bun /path/to/src/index.ts`  
Registration (built): `claude mcp add antigravity -- bunx antigravity-cli-mcp`

---

## Verification Checklist

1. `bun run src/index.ts` — no stdout before client handshake
2. `ping` — returns version + path + workspace root
3. `ask-agy` with `"say hello"` — returns text, `isError` not set
4. Timeout test — short `timeout_ms` (e.g. 100) returns `AgyTimeoutError` content
5. Missing binary — invalid `AGY_PATH` → clear error from `ping`
6. `write-file` — creates file with exact bytes at resolved path
7. Path escape test — `path: "../secret"` rejected with `AgyPathError`
8. Symlink test — symlink pointing outside workspace rejected
9. Concurrency test — >3 concurrent requests get `AgyConcurrencyError`
10. `console.log` audit — zero occurrences in `src/`
11. Claude registration — tools visible in `/mcp`
