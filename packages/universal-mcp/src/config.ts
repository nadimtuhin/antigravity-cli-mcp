export const TIMEOUT_MS = Number(process.env.AI_CLI_TIMEOUT_MS ?? 300_000);
export const SEARCH_TIMEOUT_MS = Number(process.env.AI_CLI_SEARCH_TIMEOUT_MS ?? 60_000);
export const WORKSPACE_ROOT = process.env.AI_CLI_WORKSPACE_ROOT ?? process.cwd();
export const MAX_CONCURRENT = Number(process.env.AI_CLI_MAX_CONCURRENT ?? 3);
export const DEBUG = process.env.AI_CLI_DEBUG === "1";

export const AGY_PATH = process.env.AGY_PATH ?? "/Users/nadimtuhin/.local/bin/agy";
export const KILO_PATH = process.env.KILO_PATH ?? "kilo";
export const OPENCODE_PATH = process.env.OPENCODE_PATH ?? "opencode";
export const CODEX_PATH = process.env.CODEX_PATH ?? "/opt/homebrew/bin/codex";
export const HERMES_PATH = process.env.HERMES_PATH ?? `${process.env.HOME}/.local/bin/hermes`;
