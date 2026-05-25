export const HERMES_PATH = process.env.HERMES_PATH ?? "hermes";
export const HERMES_TIMEOUT_MS = Number(process.env.HERMES_TIMEOUT_MS) || 300_000;
export const HERMES_SEARCH_TIMEOUT_MS = Number(process.env.HERMES_SEARCH_TIMEOUT_MS) || 60_000;
export const HERMES_WORKSPACE_ROOT = process.env.HERMES_WORKSPACE_ROOT ?? process.cwd();
export const HERMES_MAX_CONCURRENT = Number(process.env.HERMES_MAX_CONCURRENT) || 3;
export const HERMES_DEBUG = process.env.HERMES_DEBUG === "1";
