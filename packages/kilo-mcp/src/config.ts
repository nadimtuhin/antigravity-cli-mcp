export const KILO_PATH = process.env.KILO_PATH ?? "kilo";
export const KILO_TIMEOUT_MS = Number(process.env.KILO_TIMEOUT_MS ?? 300_000);
export const KILO_SEARCH_TIMEOUT_MS = Number(process.env.KILO_SEARCH_TIMEOUT_MS ?? 60_000);
export const KILO_WORKSPACE_ROOT = process.env.KILO_WORKSPACE_ROOT ?? process.cwd();
export const KILO_MAX_CONCURRENT = Number(process.env.KILO_MAX_CONCURRENT ?? 3);
export const KILO_DEBUG = process.env.KILO_DEBUG === "1";
