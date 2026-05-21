import { describe, test, expect, afterAll } from "bun:test";
import { writeHandler } from "./write.js";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { getTextContent } from "../../tests/helpers.js";

const workspace = mkdtempSync(tmpdir() + "/agy-write-test-");

afterAll(() => {
  try { rmSync(workspace, { recursive: true }); } catch {}
});

describe("writeHandler", () => {
  test("writes exact bytes to valid path", async () => {
    const result = await writeHandler(
      { path: "out.txt", content: "hello", create_parents: false },
      workspace
    );
    expect(result.isError).toBeUndefined();
    expect(getTextContent(result)).toContain("Written 5 bytes");
    const written = await Bun.file(workspace + "/out.txt").text();
    expect(written).toBe("hello");
  });

  test("returns byte count", async () => {
    const result = await writeHandler(
      { path: "bytes.txt", content: "12345678", create_parents: false },
      workspace
    );
    expect(getTextContent(result)).toContain("Written 8 bytes");
  });

  test("rejects path outside workspace", async () => {
    const result = await writeHandler(
      { path: "../escape.txt", content: "x", create_parents: false },
      workspace
    );
    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/escapes workspace/i);
  });

  test("creates parent dirs when create_parents=true", async () => {
    const result = await writeHandler(
      { path: "deep/nested/file.txt", content: "nested", create_parents: true },
      workspace
    );
    expect(result.isError).toBeUndefined();
    const written = await Bun.file(workspace + "/deep/nested/file.txt").text();
    expect(written).toBe("nested");
  });

  test("returns isError when parent missing and create_parents=false", async () => {
    const result = await writeHandler(
      { path: "missing/dir/file.txt", content: "x", create_parents: false },
      workspace
    );
    expect(result.isError).toBe(true);
  });
});
