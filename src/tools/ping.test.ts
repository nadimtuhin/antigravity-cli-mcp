import { describe, test, expect } from "bun:test";
import { pingHandler } from "./ping.js";
import { getTextContent } from "../../tests/helpers.js";

const FAKE_AGY = import.meta.dir + "/../../test-fixtures/fake-agy.sh";

describe("pingHandler", () => {
  test("returns version and path on success", async () => {
    const result = await pingHandler({ agyCmdPath: FAKE_AGY, workspaceRoot: "/tmp" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe("text");
    const text = getTextContent(result);
    expect(text).toContain("1.0.0");
    expect(text).toContain(FAKE_AGY);
    expect(text).toContain("executable: true");
  });

  test("returns isError when binary missing", async () => {
    const result = await pingHandler({ agyCmdPath: "/nonexistent/agy", workspaceRoot: "/tmp" });
    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/not found/i);
  });
});
