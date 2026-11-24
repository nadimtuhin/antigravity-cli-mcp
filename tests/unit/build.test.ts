import { describe, test, expect } from "bun:test";
import { mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";

const ROOT = import.meta.dir + "/../..";

describe("build", () => {
  // package.json "bin" points at dist/index.js; without a shebang, `npx antigravity-cli-mcp`
  // (the command in the README) runs the bundle through /bin/sh and fails.
  test("bundled bin starts with a bun shebang", () => {
    const outdir = mkdtempSync(tmpdir() + "/agy-build-");
    const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`, "utf8"));
    const cmd = pkg.scripts.build.replace("dist/index.js", `${outdir}/index.js`);
    const proc = Bun.spawnSync({ cmd: ["sh", "-c", cmd], cwd: ROOT });
    expect(proc.exitCode).toBe(0);
    const first = readFileSync(`${outdir}/index.js`, "utf8").split("\n")[0];
    expect(first).toBe("#!/usr/bin/env bun");
  }, 30_000);
});
