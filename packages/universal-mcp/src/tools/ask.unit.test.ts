import { describe, test, expect } from "bun:test";
import { buildArgs } from "./ask.js";

describe("buildArgs", () => {
  test("agy: --print flag", () => {
    expect(buildArgs("hi", "agy")).toEqual(["--print", "hi"]);
  });

  test("agy: cwd → --add-dir", () => {
    expect(buildArgs("hi", "agy", { cwd: "/some/dir" })).toEqual([
      "--print", "hi", "--add-dir", "/some/dir",
    ]);
  });

  test("agy: add_dirs → --add-dir for each", () => {
    expect(buildArgs("hi", "agy", { add_dirs: ["/a", "/b"] })).toEqual([
      "--print", "hi", "--add-dir", "/a", "--add-dir", "/b",
    ]);
  });

  test("agy: cwd + add_dirs deduplicates when cwd already in add_dirs", () => {
    expect(buildArgs("hi", "agy", { cwd: "/a", add_dirs: ["/a", "/b"] })).toEqual([
      "--print", "hi", "--add-dir", "/a", "--add-dir", "/b",
    ]);
  });

  test("agy: timeout_ms → --print-timeout in seconds", () => {
    expect(buildArgs("hi", "agy", { timeout_ms: 30_000 })).toEqual([
      "--print", "hi", "--print-timeout", "30s",
    ]);
  });

  test("agy: skip_permissions → --dangerously-skip-permissions", () => {
    expect(buildArgs("hi", "agy", { skip_permissions: true })).toEqual([
      "--print", "hi", "--dangerously-skip-permissions",
    ]);
  });

  test("agy: skip_permissions=false → no extra flag", () => {
    expect(buildArgs("hi", "agy", { skip_permissions: false })).toEqual(["--print", "hi"]);
  });

  test("kilo: run subcommand", () => {
    expect(buildArgs("hi", "kilo")).toEqual(["run", "hi"]);
  });

  test("kilo: with model appends --model", () => {
    expect(buildArgs("hi", "kilo", { model: "claude-sonnet" })).toEqual([
      "run", "hi", "--model", "claude-sonnet",
    ]);
  });

  test("opencode: run subcommand", () => {
    expect(buildArgs("hi", "opencode")).toEqual(["run", "hi"]);
  });

  test("opencode: with model appends --model", () => {
    expect(buildArgs("hi", "opencode", { model: "gpt-4o" })).toEqual([
      "run", "hi", "--model", "gpt-4o",
    ]);
  });

  test("codex: exec subcommand", () => {
    expect(buildArgs("hi", "codex")).toEqual(["exec", "hi"]);
  });

  test("codex: with model appends -c model=", () => {
    expect(buildArgs("hi", "codex", { model: "o3" })).toEqual([
      "exec", "hi", "-c", 'model="o3"',
    ]);
  });

  test("hermes: chat -q -Q flags", () => {
    expect(buildArgs("hi", "hermes")).toEqual(["chat", "-q", "hi", "-Q"]);
  });

  test("hermes: with model appends --model", () => {
    expect(buildArgs("hi", "hermes", { model: "MiniMax" })).toEqual([
      "chat", "-q", "hi", "-Q", "--model", "MiniMax",
    ]);
  });

  test("hermes: with max_turns appends --max-turns", () => {
    expect(buildArgs("hi", "hermes", { max_turns: 5 })).toEqual([
      "chat", "-q", "hi", "-Q", "--max-turns", "5",
    ]);
  });

  test("hermes: model and max_turns both appended", () => {
    expect(buildArgs("hi", "hermes", { model: "MiniMax", max_turns: 3 })).toEqual([
      "chat", "-q", "hi", "-Q", "--model", "MiniMax", "--max-turns", "3",
    ]);
  });
});
