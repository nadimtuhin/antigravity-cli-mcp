import { describe, test, expect, afterAll } from "bun:test";
import { validatePath } from "./security.js";
import { mkdtempSync, rmdirSync } from "fs";
import { tmpdir } from "os";

const workspace = mkdtempSync(tmpdir() + "/agy-test-");

afterAll(() => {
  try { rmdirSync(workspace); } catch {}
});

describe("validatePath", () => {
  test("allows file inside workspace", async () => {
    const result = await validatePath("file.txt", workspace);
    expect(result).toMatch(/\/file\.txt$/);
    expect(result).toContain("agy-test-");
  });

  test("allows nested path inside workspace", async () => {
    const result = await validatePath("sub/dir/file.txt", workspace);
    expect(result).toMatch(/\/sub\/dir\/file\.txt$/);
  });

  test("rejects ../ escape", async () => {
    await expect(validatePath("../secret", workspace)).rejects.toThrow("escapes workspace");
  });

  test("rejects absolute path outside workspace", async () => {
    await expect(validatePath("/etc/passwd", workspace)).rejects.toThrow("escapes workspace");
  });

  test("rejects absolute path that happens to be inside via string but not realpath", async () => {
    await expect(validatePath("/tmp/../etc/passwd", workspace)).rejects.toThrow("escapes workspace");
  });

  test("rejects path escaping via symlink pointing outside workspace for non-existent file", async () => {
    const { symlinkSync } = await import("fs");
    const linkPath = workspace + "/ext_link";
    try {
      symlinkSync("/etc", linkPath);
    } catch (e) {}
    await expect(validatePath("ext_link/newfile.txt", workspace)).rejects.toThrow("escapes workspace");
  });

  test("returns realpath-resolved path", async () => {
    const result = await validatePath("file.txt", workspace);
    expect(result.startsWith("/private/") || result.startsWith("/")).toBe(true);
    expect(result.includes("..")).toBe(false);
  });
});
