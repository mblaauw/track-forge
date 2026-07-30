import { describe, it, expect } from "vitest";
import {
  writeLyrics,
  LyricsWriterError,
  validateLyricsSemantics,
  lintRenderedLyricsRequest,
  buildLyricsPrompt,
} from "../src/llm/index.js";
import type {
  LyricsLlm,
  LyricsWriterInput,
  LyricsWriterOutput,
  PromptManifest,
} from "../src/llm/index.js";

const VOCAL = {
  type: "Rapper",
  delivery: "rhythmic",
  energy: 4,
  adlibs: false,
  harmonies: false,
};

function input(overrides?: Partial<LyricsWriterInput>): LyricsWriterInput {
  return {
    genreName: "Hip-hop",
    presetLabels: ["Trap"],
    bpm: 140,
    lineDensity: 0.5,
    sections: [
      {
        id: "intro",
        name: "Intro",
        bars: 4,
        fn: "establish",
        deltas: ["instrumental"],
      },
      {
        id: "v1",
        name: "Verse 1",
        bars: 4,
        fn: "introduce",
        deltas: ["building"],
        vocal: VOCAL,
      },
      {
        id: "hook",
        name: "Hook",
        bars: 4,
        fn: "peak",
        deltas: ["catchy"],
        vocal: VOCAL,
      },
    ],
    ...overrides,
  };
}

function validOutput(): string {
  return JSON.stringify({
    sections: [
      { id: "intro", lines: [] },
      { id: "v1", lines: ["line one", "line two"] },
      { id: "hook", lines: ["hook one", "hook two"] },
    ],
  });
}

function sequenceLlm(
  items: Array<string | Error>,
): LyricsLlm & { calls: number } {
  return {
    calls: 0,
    async complete() {
      const item = items[Math.min(this.calls, items.length - 1)]!;
      this.calls++;
      if (item instanceof Error) throw item;
      return {
        content: item,
        model: "test-model",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      };
    },
  };
}

describe("writeLyrics parser and semantic validation", () => {
  it("retries malformed JSON", async () => {
    const llm = sequenceLlm(["not json", validOutput()]);
    const result = await writeLyrics(llm, input(), { maxAttempts: 2 });
    expect(llm.calls).toBe(2);
    expect(result.sections.map((s) => s.id)).toEqual(["intro", "v1", "hook"]);
  });

  it("retries schema-invalid JSON", async () => {
    const llm = sequenceLlm([JSON.stringify({ nope: [] }), validOutput()]);
    await expect(
      writeLyrics(llm, input(), { maxAttempts: 2 }),
    ).resolves.toBeTruthy();
    expect(llm.calls).toBe(2);
  });

  it("retries schema-valid but semantically invalid JSON", async () => {
    const invalid = JSON.stringify({
      sections: [
        { id: "intro", lines: [] },
        { id: "v1", lines: ["only one"] },
        { id: "hook", lines: ["hook one", "hook two"] },
      ],
    });
    const llm = sequenceLlm([invalid, validOutput()]);
    await expect(
      writeLyrics(llm, input(), { maxAttempts: 2 }),
    ).resolves.toBeTruthy();
    expect(llm.calls).toBe(2);
  });

  it("hard-fails after retries are exhausted", async () => {
    const llm = sequenceLlm(["not json", "still not json"]);
    await expect(
      writeLyrics(llm, input(), { maxAttempts: 2 }),
    ).rejects.toMatchObject({
      type: "parse_error",
    });
    expect(llm.calls).toBe(2);
  });

  it("does not silently accept an empty lyrics document", async () => {
    const llm = sequenceLlm([JSON.stringify({ sections: [] })]);
    await expect(
      writeLyrics(llm, input(), { maxAttempts: 1 }),
    ).rejects.toMatchObject({
      type: "semantic_error",
    });
  });

  it("distinguishes provider refusal from malformed output", async () => {
    const llm = sequenceLlm(["I can't comply with that request."]);
    await expect(
      writeLyrics(llm, input(), { maxAttempts: 2 }),
    ).rejects.toMatchObject({
      type: "provider_refusal",
    });
    expect(llm.calls).toBe(1);
  });

  it("sanitizes provider errors", async () => {
    const llm = sequenceLlm([
      new Error("provider failed with sk-secret-token"),
    ]);
    await expect(writeLyrics(llm, input(), { maxAttempts: 1 })).rejects.toThrow(
      /\[redacted\]/,
    );
  });

  it("returns structured semantic issues", () => {
    const result: LyricsWriterOutput = {
      sections: [
        { id: "intro", lines: ["should be empty"] },
        { id: "v1", lines: ["[Verse 1]", "line two"] },
        { id: "extra", lines: ["x", "y"] },
      ],
    };
    const issues = validateLyricsSemantics(result, input());
    expect(issues.map((i) => i.code)).toContain("INSTRUMENTAL_NOT_EMPTY");
    expect(issues.map((i) => i.code)).toContain("EMBEDDED_SECTION_MARKER");
    expect(issues.map((i) => i.code)).toContain("SECTION_ID_MISMATCH");
  });

  it("emits a prompt manifest with retry telemetry", async () => {
    const manifests: PromptManifest[] = [];
    const llm = sequenceLlm(["not json", validOutput()]);
    await writeLyrics(llm, input(), {
      maxAttempts: 2,
      trace: {
        provider: "openai-compatible",
        model: "gpt-test",
        genre: "hiphop",
        preset: "trap",
        capturePromptText: true,
        onManifest: (manifest) => {
          manifests.push(manifest);
        },
      },
    });

    expect(manifests).toHaveLength(1);
    expect(manifests[0]!.status).toBe("success");
    expect(manifests[0]!.retryCount).toBe(1);
    expect(manifests[0]!.parsingFailures).toBe(1);
    expect(manifests[0]!.attempts).toHaveLength(2);
    expect(manifests[0]!.systemPromptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifests[0]!.systemPrompt).toContain("professional songwriter");
  });

  it("reports rendered prompt warnings without blocking generation", async () => {
    const manifests: PromptManifest[] = [];
    const llm = sequenceLlm([validOutput()]);
    await writeLyrics(llm, input(), {
      maxAttempts: 1,
      trace: {
        onManifest: (manifest) => {
          manifests.push(manifest);
        },
      },
    });

    expect(manifests[0]!.diagnostics?.map((d) => d.code)).toContain(
      "MISSING_GROUNDING",
    );
    expect(manifests[0]!.status).toBe("success");
  });

  it("blocks duplicate section ids before provider calls", async () => {
    const llm = sequenceLlm([validOutput()]);
    const badInput = input({
      sections: [
        ...input().sections,
        {
          id: "v1",
          name: "Verse 2",
          bars: 4,
          fn: "develop",
          deltas: ["building"],
          vocal: VOCAL,
        },
      ],
    });

    await expect(
      writeLyrics(llm, badInput, { maxAttempts: 1 }),
    ).rejects.toMatchObject({
      type: "prompt_lint_error",
    });
    expect(llm.calls).toBe(0);
  });

  it("blocks instrumental sections that also request vocals", async () => {
    const llm = sequenceLlm([validOutput()]);
    const badInput = input({
      sections: [
        {
          id: "intro",
          name: "Intro",
          bars: 4,
          fn: "establish",
          deltas: ["instrumental"],
          vocal: VOCAL,
        },
      ],
    });

    await expect(
      writeLyrics(llm, badInput, { maxAttempts: 1 }),
    ).rejects.toMatchObject({
      type: "prompt_lint_error",
    });
    expect(llm.calls).toBe(0);
  });

  it("detects schema/prompt contract mismatches", () => {
    const good = input({ lyricTopic: "night drive" });
    const rendered = buildLyricsPrompt(good);
    const diagnostics = lintRenderedLyricsRequest(good, {
      ...rendered,
      system: "Return a poem.",
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "SCHEMA_PROMPT_MISMATCH",
      }),
    );
  });
});
