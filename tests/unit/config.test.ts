import { describe, test, expect } from "bun:test";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";

const ROOT = import.meta.dir + "/../..";

// config.ts reads env at import time, so load it in a fresh process.
function loadConfig(env: Record<string, string>): Record<string, unknown> {
  const base: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.startsWith("AGY_")) base[k] = v;
  }
  const proc = Bun.spawnSync({
    cmd: [process.execPath, "-e", "const m = await import('./src/config.ts'); console.log(JSON.stringify(m));"],
    cwd: ROOT,
    env: { ...base, ...env },
  });
  return JSON.parse(proc.stdout.toString());
}

describe("config", () => {
  test("AGY_PATH defaults to ~/.local/bin/agy for the current user", () => {
    const home = mkdtempSync(tmpdir() + "/agy-home-");
    expect(loadConfig({ HOME: home }).AGY_PATH).toBe(`${home}/.local/bin/agy`);
  });

  test("AGY_MAX_OUTPUT_BYTES and AGY_DEBUG are read from env", () => {
    const cfg = loadConfig({ AGY_MAX_OUTPUT_BYTES: "1234", AGY_DEBUG: "1" });
    expect(cfg.AGY_MAX_OUTPUT_BYTES).toBe(1234);
    expect(cfg.AGY_DEBUG).toBe(true);
  });

  test("AGY_MAX_OUTPUT_BYTES defaults to 1MB and AGY_DEBUG to false", () => {
    const cfg = loadConfig({});
    expect(cfg.AGY_MAX_OUTPUT_BYTES).toBe(1_000_000);
    expect(cfg.AGY_DEBUG).toBe(false);
  });
});
