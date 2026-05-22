import { describe, test, expect } from "bun:test";
import { askHandler, buildAgyArgs } from "./ask.js";
import { getTextContent } from "../../tests/helpers.js";

const FAKE_AGY = import.meta.dir + "/../../test-fixtures/fake-agy.sh";
const SLOW_AGY = import.meta.dir + "/../../test-fixtures/fake-agy-slow.sh";

const FAKE_CONFIG = {
  agyCmdPath: FAKE_AGY,
  timeoutMs: 5_000,
  workspaceRoot: "/tmp",
  maxConcurrent: 3,
};

describe("buildAgyArgs", () => {
  test("minimal prompt", () => {
    const args = buildAgyArgs("hello", {});
    expect(args).toEqual(["--print", "hello"]);
  });

  test("with timeout_ms", () => {
    const args = buildAgyArgs("hello", { timeout_ms: 5000 });
    expect(args).toContain("--print-timeout");
    expect(args).toContain("5s");
  });

  test("with add_dirs", () => {
    const args = buildAgyArgs("hello", { add_dirs: ["/a", "/b"] });
    expect(args).toContain("--add-dir");
    expect(args).toContain("/a");
    expect(args).toContain("/b");
  });

  test("with skip_permissions", () => {
    const args = buildAgyArgs("hello", { skip_permissions: true });
    expect(args).toContain("--dangerously-skip-permissions");
  });

  test("does not add skip_permissions when false", () => {
    const args = buildAgyArgs("hello", { skip_permissions: false });
    expect(args).not.toContain("--dangerously-skip-permissions");
  });

  test("auto-adds cwd as --add-dir", () => {
    const args = buildAgyArgs("hello", { cwd: "/my/project" });
    expect(args).toContain("--add-dir");
    expect(args).toContain("/my/project");
  });

  test("no duplicate --add-dir when cwd already in add_dirs", () => {
    const args = buildAgyArgs("hello", { cwd: "/p", add_dirs: ["/p"] });
    const count = args.filter((a) => a === "/p").length;
    expect(count).toBe(1);
  });

  test("add_dirs without cwd: no extra --add-dir injected", () => {
    const args = buildAgyArgs("hello", { add_dirs: ["/other"] });
    expect(args.filter((a) => a === "--add-dir").length).toBe(1);
    expect(args).toContain("/other");
  });
});

describe("askHandler", () => {
  test("returns agy stdout as content", async () => {
    const result = await askHandler({ prompt: "hello" }, FAKE_CONFIG);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe("text");
    expect(getTextContent(result)).toContain("Hello from fake agy");
  });

  test("returns isError on timeout", async () => {
    const result = await askHandler(
      { prompt: "x" },
      { ...FAKE_CONFIG, agyCmdPath: SLOW_AGY, timeoutMs: 5 }
    );
    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/timed out/i);
  }, 10_000);
});
