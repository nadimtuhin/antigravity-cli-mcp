import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function getTextContent(result: CallToolResult): string {
  const item = result.content[0];
  if (!item || item.type !== "text") {
    throw new Error(`Expected text content, got: ${item?.type ?? "empty"}`);
  }
  return item.text;
}
