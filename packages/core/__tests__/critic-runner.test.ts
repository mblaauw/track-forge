import { describe, it, expect } from "vitest";
import { parseFindings } from "../src/pipeline/critic-runner.js";
import type { CriticFinding } from "@track-forge/contracts";

describe("parseFindings", () => {
  function isError(f: CriticFinding): boolean {
    return f.severity === "error";
  }

  it("extracts JSON array from plain text", () => {
    const text = JSON.stringify([
      {
        severity: "error",
        field: "style",
        message: "BPM too high",
        autoFixPolicy: "required",
      },
    ]);
    const findings = parseFindings(text);
    expect(findings).toHaveLength(1);
    expect(isError(findings[0])).toBe(true);
    expect(findings[0].field).toBe("style");
  });

  it("extracts JSON array from markdown-fenced text", () => {
    const text = [
      "Here are my findings:",
      "```json",
      JSON.stringify([
        {
          severity: "error",
          field: "style",
          message: "BPM too high",
          autoFixPolicy: "required",
        },
        {
          severity: "warning",
          field: "lyrics",
          message: "Low energy",
          autoFixPolicy: "preferred",
        },
      ]),
      "```",
    ].join("\n");

    const findings = parseFindings(text);
    expect(findings).toHaveLength(2);
    expect(isError(findings[0])).toBe(true);
    expect(findings[1].severity).toBe("warning");
  });

  it("returns empty array for non-JSON text", () => {
    expect(parseFindings("No issues found.")).toHaveLength(0);
    expect(parseFindings("")).toHaveLength(0);
  });

  it("normalizes missing fields to defaults", () => {
    const text = JSON.stringify([{ severity: "error" }, {}]);
    const findings = parseFindings(text);
    expect(findings).toHaveLength(2);
    expect(findings[0].field).toBe("unknown");
    expect(findings[1].field).toBe("unknown");
    expect(findings[1].autoFixPolicy).toBe("skipped");
  });

  it("preserves optional fields when present", () => {
    const text = JSON.stringify([
      {
        severity: "error",
        field: "style",
        message: "Fix this",
        autoFixPolicy: "required",
        patchType: "replace_style_description",
        suggestedValue: "New style description",
      },
    ]);
    const findings = parseFindings(text);
    expect(findings[0].patchType).toBe("replace_style_description");
    expect(findings[0].suggestedValue).toBe("New style description");
  });

  it("handles multiple arrays in text by using first match", () => {
    const text = [
      JSON.stringify([
        {
          severity: "error",
          field: "style",
          message: "Issue 1",
          autoFixPolicy: "required",
        },
      ]),
      "Some text",
      JSON.stringify([
        {
          severity: "warning",
          field: "lyrics",
          message: "Issue 2",
          autoFixPolicy: "preferred",
        },
      ]),
    ].join("\n");

    const findings = parseFindings(text);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toBe("Issue 1");
  });

  it("extracts JSON array with markdown fence but no language tag", () => {
    const text = [
      "```",
      JSON.stringify([
        {
          severity: "error",
          field: "style",
          message: "Bad tags",
          autoFixPolicy: "required",
        },
      ]),
      "```",
    ].join("\n");

    const findings = parseFindings(text);
    expect(findings).toHaveLength(1);
    expect(findings[0].field).toBe("style");
  });
});
