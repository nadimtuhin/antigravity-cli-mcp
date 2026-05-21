# antigravity-cli-mcp

An MCP (Model Context Protocol) server wrapping the `agy` (antigravity) CLI. This server exposes the capabilities of the `agy` tool to MCP clients like Claude Code, Cursor, and other stdio JSON-RPC compatible LLM interfaces.

## Features

- Exposes 4 core tools: `ping`, `ask-agy`, `search-web`, and `write-file`.
- Manages subprocess execution using Bun's fast `Bun.spawn` engine.
- Implements concurrency limits and resource constraints (timeout, max memory/output bytes, workspace directory confinement).
- Emits real-time streaming progress notifications back to the LLM client using MCP `notifications/progress` protocol.
- Strict path validation to ensure file access does not escape the workspace.

---

## Installation & Registration

### Prerequisites

- **Bun** (v1.0.0 or higher) installed.
- **agy** (antigravity CLI) binary installed on your system.

### Registering with Claude Code

#### Development Mode

To run directly from the TypeScript source files with hot-reloading:

```bash
claude mcp add antigravity-cli-mcp -- bun run --cwd /Users/nadimtuhin/opensource/antigravity-cli-mcp src/index.ts
```

#### Production Mode (Built Bundle)

First, build the production bundle:

```bash
bun run build
```

Then register the compiled index file:

```bash
claude mcp add antigravity-cli-mcp -- bun /Users/nadimtuhin/opensource/antigravity-cli-mcp/dist/index.js
```

---

## Configuration

You can configure the MCP server by setting the following environment variables:

| Environment Variable | Default Value | Description |
|---|---|---|
| `AGY_PATH` | `/Users/nadimtuhin/.local/bin/agy` | The absolute path to the `agy` CLI binary. |
| `AGY_TIMEOUT_MS` | `300000` (5 minutes) | Timeout in milliseconds for general `ask-agy` prompts. |
| `AGY_SEARCH_TIMEOUT_MS` | `60000` (1 minute) | Timeout in milliseconds specifically for `search-web` queries. |
| `AGY_WORKSPACE_ROOT` | `process.cwd()` | The root directory for file validation and execution context. |
| `AGY_MAX_CONCURRENT` | `3` | Maximum number of concurrent `agy` processes allowed to run. |
| `AGY_MAX_OUTPUT_BYTES` | `1000000` (1MB) | Maximum stdout size allowed from `agy` before truncating. |
| `AGY_DEBUG` | `0` (or unset) | Set to `1` to enable verbose debugging logs on `stderr`. |

---

## Tools

The server registers 4 MCP tools:

### 1. `ping`
- **Description**: Check `agy` health, version, binary path, and active workspace root.
- **Input Schema**: `{}` (none)
- **Response**: Details of the `agy` binary version and execution capabilities.

### 2. `ask-agy`
- **Description**: Runs a prompt non-interactively with `agy`.
- **Input Schema**:
  - `prompt` (string, max 10k chars): The prompt to send to `agy`.
  - `cwd` (string, optional): Override the working directory.
  - `timeout_ms` (integer, optional): Override default execution timeout.
  - `add_dirs` (array of strings, optional): Extra directories to register for prompt context.
  - `skip_permissions` (boolean, optional): Skip safety/permission prompts by adding `--dangerously-skip-permissions` to the binary invocation.

### 3. `search-web`
- **Description**: Perform web search queries via `agy`. Results come from `agy`'s search integration.
- **Input Schema**:
  - `query` (string, max 500 chars): The search query.

### 4. `write-file`
- **Description**: Write exact text content to a file inside the workspace root (does not call the `agy` binary).
- **Input Schema**:
  - `path` (string): The destination path (relative to the workspace root).
  - `content` (string, max 500k chars): The content to write.
  - `create_parents` (boolean, default `false`): If true, creates parent directories if they don't exist.

---

## Streaming / Progress Notifications

For long-running CLI invocations, the `ask-agy` and `search-web` tools support progress updates. When an MCP client provides a `progressToken` in the tool call metadata:

1. The server listens to the raw stdout chunks from `Bun.spawn()`.
2. It sends `notifications/progress` JSON-RPC updates containing the token, incremental sequence number, and the raw text output chunk as the message.
3. This allows compatible clients (such as Claude Code) to render output dynamically to the user while `agy` is still processing.

---

## Development

All standard lifecycle scripts are managed through `bun`:

### Running Tests
Execute the unit and integration test suite:
```bash
bun test
```

### Type Checking
Validate the TypeScript codebase:
```bash
bun run typecheck
```

### Building the Project
Compile the TypeScript code into a single executable bundle at `dist/index.js`:
```bash
bun run build
```
