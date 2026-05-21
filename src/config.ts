export const AGY_PATH = process.env.AGY_PATH ?? "/Users/nadimtuhin/.local/bin/agy";
export const AGY_TIMEOUT_MS = Number(process.env.AGY_TIMEOUT_MS ?? 300_000);
export const AGY_SEARCH_TIMEOUT_MS = Number(process.env.AGY_SEARCH_TIMEOUT_MS ?? 60_000);
export const AGY_WORKSPACE_ROOT = process.env.AGY_WORKSPACE_ROOT ?? process.cwd();
export const AGY_MAX_CONCURRENT = Number(process.env.AGY_MAX_CONCURRENT ?? 3);
