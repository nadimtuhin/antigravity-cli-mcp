import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdir, rm, realpath } from "fs/promises";
import { validatePath, CliPathError } from "./index.js";

const ROOT_TMP = `/tmp/security-test-${Date.now()}`;
let ROOT = ROOT_TMP;

beforeAll(async () => {
  await mkdir(ROOT_TMP, { recursive: true });
  ROOT = await realpath(ROOT_TMP);
});

afterAll(async () => {
  await rm(ROOT_TMP, { recursive: true, force: true });
});

describe("validatePath", () => {
  test("valid relative path within workspace → returns absolute path", async () => {
    const result = await validatePath("file.txt", ROOT);
    expect(result).toBe(`${ROOT}/file.txt`);
  }, 10_000);

  test("path traversal → throws CliPathError", async () => {
    await expect(
      validatePath("../../etc/passwd", ROOT)
    ).rejects.toBeInstanceOf(CliPathError);
  }, 10_000);

  test("absolute path outside workspace → throws CliPathError", async () => {
    await expect(
      validatePath("/etc/passwd", ROOT)
    ).rejects.toBeInstanceOf(CliPathError);
  }, 10_000);

  test("absolute path inside workspace → returns resolved path", async () => {
    const result = await validatePath(`${ROOT}/file.txt`, ROOT);
    expect(result).toBe(`${ROOT}/file.txt`);
  }, 10_000);

  test("symlink inside workspace pointing outside → throws CliPathError", async () => {
    const { symlink } = await import("fs/promises");
    const linkPath = `${ROOT}/evil-link`;
    await symlink("/etc/passwd", linkPath).catch(() => {});
    await expect(
      validatePath("evil-link", ROOT)
    ).rejects.toBeInstanceOf(CliPathError);
  }, 10_000);
});
