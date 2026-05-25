import { describe, test, expect } from "bun:test";

// Directly test the numeric parsing pattern used in config.ts
// These tests document the contract: invalid/empty env vars fall back to defaults

function parseNumericEnv(value: string | undefined, fallback: number): number {
  return Number(value) || fallback;
}

describe("config numeric env parsing", () => {
  test("undefined → fallback", () => {
    expect(parseNumericEnv(undefined, 300_000)).toBe(300_000);
  });

  test("empty string → fallback (not 0)", () => {
    // The old pattern Number(value ?? fallback) would give Number("") = 0
    // The new pattern Number(value) || fallback correctly falls back
    expect(parseNumericEnv("", 300_000)).toBe(300_000);
  });

  test("non-numeric string → fallback (not NaN)", () => {
    // The old pattern Number("abc" ?? fallback) = NaN, silently breaking timeouts
    expect(parseNumericEnv("abc", 300_000)).toBe(300_000);
  });

  test("valid numeric string → parsed value", () => {
    expect(parseNumericEnv("60000", 300_000)).toBe(60_000);
  });

  test("'0' → fallback (0ms timeout is invalid; || treats 0 as falsy)", () => {
    // Setting timeout to exactly 0 would still use fallback, which is acceptable
    // since a 0ms timeout is not a valid operational value
    expect(parseNumericEnv("0", 300_000)).toBe(300_000);
  });
});
