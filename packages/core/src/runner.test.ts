import { describe, test, expect } from "bun:test";
import { runCli, CliNotFoundError, CliTimeoutError, CliExitError, CliConcurrencyError } from "./index.js";

describe("runCli", () => {
  test("success: returns stdout, stderr, exitCode", async () => {
    const result = await runCli(["hello"], {
      cliCmdPath: "/bin/echo",
    });
    expect(result.stdout).toBe("hello\n");
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
  }, 10_000);

  test("ENOENT: throws CliNotFoundError", async () => {
    await expect(
      runCli([], { cliCmdPath: "/nonexistent/binary" })
    ).rejects.toBeInstanceOf(CliNotFoundError);
  }, 10_000);

  test("non-zero exit: throws CliExitError with correct exitCode", async () => {
    const err = await runCli(["-c", "exit 42"], { cliCmdPath: "/bin/sh" }).catch((e) => e);
    expect(err).toBeInstanceOf(CliExitError);
    expect((err as CliExitError).exitCode).toBe(42);
  }, 10_000);

  test("non-zero exit with output: CliExitError carries stdout and stderr", async () => {
    const err = await runCli(
      ["-c", "echo 'out line'; echo 'err line' >&2; exit 1"],
      { cliCmdPath: "/bin/sh" }
    ).catch((e) => e);
    expect(err).toBeInstanceOf(CliExitError);
    expect((err as CliExitError).stdout).toContain("out line");
    expect((err as CliExitError).stderr).toContain("err line");
  }, 10_000);

  test("timeout: throws CliTimeoutError", async () => {
    await expect(
      runCli(["-c", "sleep 5"], { cliCmdPath: "/bin/sh", timeoutMs: 100 })
    ).rejects.toBeInstanceOf(CliTimeoutError);
  }, 10_000);

  test("concurrency: second call throws CliConcurrencyError when limit exceeded", async () => {
    const results = await Promise.allSettled([
      runCli(["-c", "sleep 0.5"], { cliCmdPath: "/bin/sh", maxConcurrent: 1 }),
      runCli(["-c", "sleep 0.5"], { cliCmdPath: "/bin/sh", maxConcurrent: 1 }),
    ]);
    const statuses = results.map((r) => r.status);
    expect(statuses).toContain("fulfilled");
    expect(statuses).toContain("rejected");

    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(CliConcurrencyError);
  }, 10_000);

  test("onChunk: called with stdout content", async () => {
    const chunks: string[] = [];
    await runCli(["hello"], {
      cliCmdPath: "/bin/echo",
      onChunk: (chunk) => chunks.push(chunk),
    });
    expect(chunks.join("")).toContain("hello");
  }, 10_000);

  test("maxOutputBytes: output capped and process killed", async () => {
    const result = await runCli(["-c", "printf '%0.s1234567890' {1..200}"], {
      cliCmdPath: "/bin/sh",
      maxOutputBytes: 100,
    });
    expect(result.stdout.length).toBeLessThanOrEqual(100);
    expect(result.timedOut).toBe(false);
  }, 10_000);

  test("maxOutputBytes: does not throw CliExitError when process killed by cap", async () => {
    // Previously this was flaky: when SIGTERM arrived before process exited,
    // non-zero exit code caused CliExitError to be thrown instead of returning.
    await expect(
      runCli(["-c", "yes"], { cliCmdPath: "/bin/sh", maxOutputBytes: 50 })
    ).resolves.toMatchObject({ stdout: expect.any(String) });
  }, 10_000);
});
