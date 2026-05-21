import { describe, test, expect } from "bun:test";
import { runAgy } from "./runner.js";
import {
  AgyNotFoundError,
  AgyTimeoutError,
  AgyExitError,
  AgyConcurrencyError,
} from "./types.js";

const FAKE_AGY = import.meta.dir + "/../test-fixtures/fake-agy.sh";
const SLOW_AGY = import.meta.dir + "/../test-fixtures/fake-agy-slow.sh";

describe("runAgy", () => {
  test("returns stdout on success", async () => {
    const result = await runAgy(["--version"], { agyCmdPath: FAKE_AGY });
    expect(result.stdout.trim()).toBe("1.0.0");
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
  });

  test("returns --print output", async () => {
    const result = await runAgy(["--print", "hi"], { agyCmdPath: FAKE_AGY });
    expect(result.stdout).toContain("Hello from fake agy");
    expect(result.exitCode).toBe(0);
  });

  test("throws AgyExitError on non-zero exit", async () => {
    await expect(runAgy(["--bad-flag"], { agyCmdPath: FAKE_AGY })).rejects.toBeInstanceOf(AgyExitError);
  });

  test("AgyExitError contains stdout and exitCode", async () => {
    try {
      await runAgy(["--bad-flag"], { agyCmdPath: FAKE_AGY });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(AgyExitError);
      const err = e as AgyExitError;
      expect(err.exitCode).toBe(1);
    }
  });

  test("throws AgyNotFoundError for missing binary", async () => {
    await expect(runAgy(["--version"], { agyCmdPath: "/nonexistent/agy" })).rejects.toBeInstanceOf(AgyNotFoundError);
  });

  test("throws AgyTimeoutError on timeout", async () => {
    const slowAgy = import.meta.dir + "/../test-fixtures/fake-agy.sh";
    await expect(
      runAgy(["--print", "x"], { agyCmdPath: slowAgy, timeoutMs: 1 })
    ).rejects.toBeInstanceOf(AgyTimeoutError);
  }, 10_000);

  test("calls onChunk with each chunk as it arrives", async () => {
    const chunks: string[] = [];
    await runAgy(["--print", "x"], {
      agyCmdPath: SLOW_AGY,
      onChunk: (chunk) => chunks.push(chunk),
    });
    expect(chunks.length).toBeGreaterThan(0);
    const combined = chunks.join("");
    expect(combined).toContain("chunk one");
    expect(combined).toContain("chunk two");
    expect(combined).toContain("chunk three");
  }, 5_000);

  test("onChunk receives chunks before process exits", async () => {
    const chunkTimes: number[] = [];
    const start = Date.now();
    await runAgy(["--print", "x"], {
      agyCmdPath: SLOW_AGY,
      onChunk: () => chunkTimes.push(Date.now() - start),
    });
    expect(chunkTimes.length).toBeGreaterThanOrEqual(2);
    // chunks should arrive at different times (not all at end)
    const spread = chunkTimes[chunkTimes.length - 1] - chunkTimes[0];
    expect(spread).toBeGreaterThan(0);
  }, 5_000);

  test("throws AgyConcurrencyError when limit exceeded", async () => {
    const calls = Array.from({ length: 4 + 1 }, () =>
      runAgy(["--version"], { agyCmdPath: FAKE_AGY, maxConcurrent: 4 })
    );
    const results = await Promise.allSettled(calls);
    const rejected = results.filter((r) => r.status === "rejected");
    const hasConcurrencyError = rejected.some(
      (r) => (r as PromiseRejectedResult).reason instanceof AgyConcurrencyError
    );
    expect(hasConcurrencyError).toBe(true);
  });
});
