import { describe, test, expect } from "bun:test";
import { searchHandler } from "./search.js";
import { getTextContent } from "../../tests/helpers.js";

const FAKE_AGY = import.meta.dir + "/../../test-fixtures/fake-agy.sh";

const FAKE_CONFIG = {
  agyCmdPath: FAKE_AGY,
  searchTimeoutMs: 5_000,
  workspaceRoot: "/tmp",
  maxConcurrent: 3,
};

describe("searchHandler", () => {
  test("prefixes query with search instruction", async () => {
    const result = await searchHandler({ query: "MCP typescript" }, FAKE_CONFIG);
    expect(result.isError).toBeUndefined();
    expect(getTextContent(result)).toContain("Search the web for: MCP typescript");
  });

  test("returns content from agy", async () => {
    const result = await searchHandler({ query: "bun runtime" }, FAKE_CONFIG);
    expect(result.content[0].type).toBe("text");
    expect(getTextContent(result).length).toBeGreaterThan(0);
  });
});
