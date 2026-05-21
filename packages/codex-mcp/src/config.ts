export const CODEX_PATH = process.env.CODEX_PATH ?? "codex";
export const CODEX_TIMEOUT_MS = Number(process.env.CODEX_TIMEOUT_MS ?? 300_000);
export const CODEX_SEARCH_TIMEOUT_MS = Number(process.env.CODEX_SEARCH_TIMEOUT_MS ?? 60_000);
export const CODEX_WORKSPACE_ROOT = process.env.CODEX_WORKSPACE_ROOT ?? process.cwd();
export const CODEX_MAX_CONCURRENT = Number(process.env.CODEX_MAX_CONCURRENT ?? 3);
export const CODEX_DEBUG = process.env.CODEX_DEBUG === "1";
