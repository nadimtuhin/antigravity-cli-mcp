export const OPENCODE_PATH = process.env.OPENCODE_PATH ?? "opencode";
export const OPENCODE_TIMEOUT_MS = Number(process.env.OPENCODE_TIMEOUT_MS) || 300_000;
export const OPENCODE_SEARCH_TIMEOUT_MS = Number(process.env.OPENCODE_SEARCH_TIMEOUT_MS) || 60_000;
export const OPENCODE_WORKSPACE_ROOT = process.env.OPENCODE_WORKSPACE_ROOT ?? process.cwd();
export const OPENCODE_MAX_CONCURRENT = Number(process.env.OPENCODE_MAX_CONCURRENT) || 3;
export const OPENCODE_DEBUG = process.env.OPENCODE_DEBUG === "1";
