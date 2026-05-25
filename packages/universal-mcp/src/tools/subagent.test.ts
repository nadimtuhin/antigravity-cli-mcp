import { describe, test, expect, beforeEach } from "bun:test";
import { makeSubHandler, getResultHandler, jobs, cleanupExpired } from "./subagent.js";

const F = import.meta.dir + "/../../test-fixtures";

const config = {
  paths: {
    agy: `${F}/fake-agy.sh`,
    kilo: `${F}/fake-kilo.sh`,
    opencode: `${F}/fake-opencode.sh`,
    codex: `${F}/fake-codex.sh`,
    hermes: `${F}/fake-hermes.sh`,
  },
  timeoutMs: 10_000,
  workspaceRoot: "/tmp",
  maxConcurrent: 5,
  debug: false,
};

function text(result: ReturnType<typeof getResultHandler>): string {
  const item = result.content[0];
  if (item.type !== "text") throw new Error("expected text content");
  return item.text;
}

function extractJobId(subText: string): string {
  const match = subText.match(/Job (\S+) started/);
  if (!match) throw new Error(`no job ID in: ${subText}`);
  return match[1];
}

beforeEach(() => {
  jobs.clear();
});

describe("makeSubHandler + getResultHandler", () => {
  test("successful job → status done, result text returned", async () => {
    const handler = makeSubHandler("agy", config);
    const subResult = handler({ prompt: "hello" }, undefined);
    const jobId = extractJobId(text(subResult));

    await new Promise((r) => setTimeout(r, 500));

    const result = getResultHandler(jobId);
    expect(text(result)).toContain("Hello from fake agy: hello");
  }, 10_000);

  test("failed job (missing binary) → status error, 'failed' in result", async () => {
    const badConfig = { ...config, paths: { ...config.paths, agy: "/nonexistent/agy" } };
    const handler = makeSubHandler("agy", badConfig);
    const subResult = handler({ prompt: "hello" }, undefined);
    const jobId = extractJobId(text(subResult));

    await new Promise((r) => setTimeout(r, 500));

    const result = getResultHandler(jobId);
    expect(text(result)).toContain("failed");
  }, 10_000);

  test("job CLI exits non-zero → error stored with stderr preserved in get-result", async () => {
    const errorConfig = { ...config, paths: { ...config.paths, kilo: `${F}/fake-kilo-error.sh` } };
    const handler = makeSubHandler("kilo", errorConfig);
    const subResult = handler({ prompt: "hello" }, undefined);
    const jobId = extractJobId(text(subResult));

    await new Promise((r) => setTimeout(r, 500));

    const result = getResultHandler(jobId);
    const out = text(result);
    expect(out).toContain("failed");
    expect(out).toContain("kilo internal failure");
  }, 10_000);

  test("running job → 'still running' message, job stays in map", async () => {
    const handler = makeSubHandler("agy", config);
    const subResult = handler({ prompt: "hello" }, undefined);
    const jobId = extractJobId(text(subResult));

    const result = getResultHandler(jobId);
    expect(text(result)).toContain("still running");
  }, 10_000);

  test("get-result on unknown job → 'not found' message", () => {
    const result = getResultHandler("nonexistent-id");
    expect(text(result)).toContain("not found");
  });

  test("second get-result on completed job → 'not found'", async () => {
    const handler = makeSubHandler("agy", config);
    const subResult = handler({ prompt: "hello" }, undefined);
    const jobId = extractJobId(text(subResult));

    await new Promise((r) => setTimeout(r, 500));

    getResultHandler(jobId); // first call — consumes the job
    const second = getResultHandler(jobId);
    expect(text(second)).toContain("not found");
  }, 10_000);

  test("cleanupExpired removes completed jobs older than TTL", () => {
    const oldJob = { status: "done" as const, result: "old", cli: "agy" as const, startedAt: 0, completedAt: Date.now() - 11 * 60 * 1000 };
    const newJob = { status: "done" as const, result: "new", cli: "agy" as const, startedAt: 0, completedAt: Date.now() };
    jobs.set("old-id", oldJob);
    jobs.set("new-id", newJob);
    cleanupExpired();
    expect(jobs.has("old-id")).toBe(false);
    expect(jobs.has("new-id")).toBe(true);
  });

  test("cleanupExpired does not remove running jobs regardless of age", () => {
    const runningJob = { status: "running" as const, cli: "agy" as const, startedAt: 0 };
    jobs.set("run-id", runningJob);
    cleanupExpired();
    expect(jobs.has("run-id")).toBe(true);
  });

  test("completed job is deleted from map after get-result", async () => {
    const handler = makeSubHandler("agy", config);
    const subResult = handler({ prompt: "hello" }, undefined);
    const jobId = extractJobId(text(subResult));

    await new Promise((r) => setTimeout(r, 500));

    getResultHandler(jobId);
    expect(jobs.has(jobId)).toBe(false);
  }, 10_000);
});
