import { describe, test, expect } from "bun:test";
import { freeTierWarning, buildUsageReport, fetchStats, type StatsResult } from "./usage.js";

describe("freeTierWarning", () => {
  test("$0.00 cost → warning message", () => {
    expect(freeTierWarning("Total Cost  $0.00")).toContain("Free tier detected");
  });

  test("non-zero cost → empty string", () => {
    expect(freeTierWarning("Total Cost  $5.23")).toBe("");
  });

  test("no cost line → empty string", () => {
    expect(freeTierWarning("sessions: 10, messages: 100")).toBe("");
  });

  test("zero cost without $ sign → warning", () => {
    expect(freeTierWarning("Total Cost  0.00")).toContain("Free tier detected");
  });
});

describe("buildUsageReport", () => {
  const okKilo: StatsResult = { ok: true, output: "Total Cost  $0.00" };
  const okOpencode: StatsResult = { ok: true, output: "Total Cost  $0.00" };
  const okHermes: StatsResult = { ok: true, output: "Total tokens: 1000" };

  test("includes all 5 section headers", () => {
    const out = buildUsageReport(okKilo, okOpencode, okHermes);
    for (const name of ["agy", "kilo", "opencode", "codex", "hermes"]) {
      expect(out).toContain(`═══ ${name} ═══`);
    }
  });

  test("agy and codex show no-tracking notice", () => {
    const out = buildUsageReport(okKilo, okOpencode, okHermes);
    const agySec = out.split("═══ agy ═══")[1]?.split("═══")[0] ?? "";
    const codexSec = out.split("═══ codex ═══")[1]?.split("═══")[0] ?? "";
    expect(agySec).toContain("No balance tracking");
    expect(codexSec).toContain("No balance tracking");
  });

  test("kilo $0.00 → free tier warning in kilo section", () => {
    const out = buildUsageReport(okKilo, okOpencode, okHermes);
    const kiloSec = out.split("═══ kilo ═══")[1]?.split("═══")[0] ?? "";
    expect(kiloSec).toContain("Free tier detected");
  });

  test("kilo non-zero cost → no free tier warning", () => {
    const paid: StatsResult = { ok: true, output: "Total Cost  $5.00" };
    const out = buildUsageReport(paid, okOpencode, okHermes);
    const kiloSec = out.split("═══ kilo ═══")[1]?.split("═══")[0] ?? "";
    expect(kiloSec).not.toContain("Free tier detected");
  });

  test("failed kilo → exhausted error message", () => {
    const failed: StatsResult = { ok: false, output: "auth error" };
    const out = buildUsageReport(failed, okOpencode, okHermes);
    const kiloSec = out.split("═══ kilo ═══")[1]?.split("═══")[0] ?? "";
    expect(kiloSec).toContain("Free token limit likely exhausted");
    expect(kiloSec).toContain("auth error");
  });

  test("failed hermes → 'Failed to fetch insights'", () => {
    const out = buildUsageReport(okKilo, okOpencode, { ok: false, output: "connection refused" });
    const hermesSec = out.split("═══ hermes ═══")[1] ?? "";
    expect(hermesSec).toContain("Failed to fetch insights");
  });

  test("kilo timed out → 'stats timed out' not 'exhausted'", () => {
    const timedOut: StatsResult = { ok: false, output: "kilo timed out" };
    const out = buildUsageReport(timedOut, okOpencode, okHermes);
    const kiloSec = out.split("═══ kilo ═══")[1]?.split("═══")[0] ?? "";
    expect(kiloSec).toContain("timed out");
    expect(kiloSec).not.toContain("exhausted");
  });

  test("hermes timed out → 'insights timed out' not 'Failed to fetch'", () => {
    const out = buildUsageReport(okKilo, okOpencode, { ok: false, output: "hermes timed out" });
    const hermesSec = out.split("═══ hermes ═══")[1] ?? "";
    expect(hermesSec).toContain("timed out");
    expect(hermesSec).not.toContain("Failed to fetch");
  });
});

describe("fetchStats with injectable runner", () => {
  test("successful runner → ok:true, trimmed output", async () => {
    const runner = async () => ({ stdout: "  usage data  \n", stderr: "" });
    const result = await fetchStats("tool", "/any", ["stats"], runner as any);
    expect(result.ok).toBe(true);
    expect(result.output).toBe("usage data");
  });

  test("runner throws non-Error → ok:false, String(e) as output", async () => {
    const runner = async () => { throw "quota exceeded"; };
    const result = await fetchStats("tool", "/any", ["stats"], runner as any);
    expect(result.ok).toBe(false);
    expect(result.output).toBe("quota exceeded");
  });

  test("runner throws Error → ok:false, e.message as output", async () => {
    const runner = async () => { throw new Error("network failure"); };
    const result = await fetchStats("tool", "/any", ["stats"], runner as any);
    expect(result.ok).toBe(false);
    expect(result.output).toBe("network failure");
  });
});
