import { describe, test, expect } from "bun:test";
import { askHandler, buildArgs, type AskConfig, type McpExtra } from "./ask.js";

const F = import.meta.dir + "/../../test-fixtures";

const config: AskConfig = {
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

function text(result: Awaited<ReturnType<typeof askHandler>>): string {
  const item = result.content[0];
  if (item.type !== "text") throw new Error("expected text content");
  return item.text;
}

describe("askHandler", () => {
  test("via=agy uses --print flag", async () => {
    const result = await askHandler({ prompt: "hello", via: "agy" }, config);
    expect(result.isError).toBeUndefined();
    expect(text(result)).toContain("Hello from fake agy: hello");
  }, 10_000);

  test("via=kilo uses run subcommand", async () => {
    const result = await askHandler({ prompt: "hello", via: "kilo" }, config);
    expect(result.isError).toBeUndefined();
    expect(text(result)).toContain("Hello from fake kilo: hello");
  }, 10_000);

  test("via=opencode uses run subcommand", async () => {
    const result = await askHandler({ prompt: "hello", via: "opencode" }, config);
    expect(result.isError).toBeUndefined();
    expect(text(result)).toContain("Hello from fake opencode: hello");
  }, 10_000);

  test("via=codex uses exec subcommand", async () => {
    const result = await askHandler({ prompt: "hello", via: "codex" }, config);
    expect(result.isError).toBeUndefined();
    expect(text(result)).toContain("Hello from fake codex: hello");
  }, 10_000);

  test("via=hermes uses chat -q flag", async () => {
    const result = await askHandler({ prompt: "hello", via: "hermes" }, config);
    expect(result.isError).toBeUndefined();
    expect(text(result)).toContain("Hello from fake hermes: hello");
  }, 10_000);

  test("missing binary → isError with 'not found' message", async () => {
    const result = await askHandler(
      { prompt: "hello", via: "kilo" },
      { ...config, paths: { ...config.paths, kilo: "/nonexistent/kilo" } }
    );
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("not found");
  }, 10_000);

  test("CLI exits non-zero → isError with stderr preserved (not generic exit code msg)", async () => {
    const result = await askHandler(
      { prompt: "hello", via: "kilo" },
      { ...config, paths: { ...config.paths, kilo: `${F}/fake-kilo-error.sh` } }
    );
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("kilo internal failure");
  }, 10_000);

  test("concurrency limit exceeded → isError with concurrency message", async () => {
    const result = await askHandler({ prompt: "hello", via: "kilo" }, { ...config, maxConcurrent: 0 });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/concurrent/i);
  }, 10_000);

  test("timeout → isError with timeout message", async () => {
    const result = await askHandler(
      { prompt: "hello", via: "agy", timeout_ms: 1 },
      config
    );
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/timed out/i);
  }, 10_000);

  test("progress notifications emitted when extra has progressToken", async () => {
    const notifications: unknown[] = [];
    const mockExtra = {
      _meta: { progressToken: "tok-1" },
      sendNotification: async (n: unknown) => { notifications.push(n); },
    } as unknown as McpExtra;
    const result = await askHandler({ prompt: "hello", via: "agy" }, config, mockExtra);
    expect(result.isError).toBeUndefined();
    expect(notifications.length).toBeGreaterThan(0);
    const first = notifications[0] as { method: string; params: { progressToken: string } };
    expect(first.method).toBe("notifications/progress");
    expect(first.params.progressToken).toBe("tok-1");
  }, 10_000);
});

describe("buildArgs — agy cwd promotion", () => {
  test("via=agy with cwd injects --add-dir", () => {
    const args = buildArgs("hello", "agy", { cwd: "/my/project" });
    expect(args).toContain("--add-dir");
    expect(args).toContain("/my/project");
  });

  test("via=kilo with cwd does NOT inject --add-dir", () => {
    const args = buildArgs("hello", "kilo", { cwd: "/my/project" });
    expect(args).not.toContain("--add-dir");
  });

  test("via=agy without cwd: no --add-dir", () => {
    const args = buildArgs("hello", "agy", {});
    expect(args).not.toContain("--add-dir");
  });
});

describe("buildArgs — agy timeout and skip_permissions", () => {
  test("via=agy with timeout_ms injects --print-timeout", () => {
    const args = buildArgs("hello", "agy", { timeout_ms: 5000 });
    expect(args).toContain("--print-timeout");
    expect(args).toContain("5s");
  });

  test("via=agy with skip_permissions injects --dangerously-skip-permissions", () => {
    const args = buildArgs("hello", "agy", { skip_permissions: true });
    expect(args).toContain("--dangerously-skip-permissions");
  });

  test("via=kilo with skip_permissions does NOT inject --dangerously-skip-permissions", () => {
    const args = buildArgs("hello", "kilo", { skip_permissions: true });
    expect(args).not.toContain("--dangerously-skip-permissions");
  });
});

describe("buildArgs — agy add_dirs", () => {
  test("via=agy with add_dirs injects --add-dir for each", () => {
    const args = buildArgs("hello", "agy", { add_dirs: ["/a", "/b"] });
    expect(args).toContain("--add-dir");
    expect(args).toContain("/a");
    expect(args).toContain("/b");
  });

  test("via=agy deduplicates cwd and add_dirs", () => {
    const args = buildArgs("hello", "agy", { cwd: "/p", add_dirs: ["/p"] });
    const count = args.filter((a) => a === "/p").length;
    expect(count).toBe(1);
  });

  test("via=agy deduplicates duplicate entries in add_dirs", () => {
    const args = buildArgs("hello", "agy", { add_dirs: ["/a", "/a"] });
    const count = args.filter((a) => a === "/a").length;
    expect(count).toBe(1);
  });

  test("via=kilo with add_dirs does NOT inject --add-dir", () => {
    const args = buildArgs("hello", "kilo", { add_dirs: ["/a"] });
    expect(args).not.toContain("--add-dir");
  });
});
