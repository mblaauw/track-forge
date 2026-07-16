import { describe, it, expect } from "vitest";
import {
  ConfigSchema,
  GenerationStage,
  JobStatus,
  VersionStatus,
  SunoArtifactType,
  CriticSeverity,
  AutoFixPolicy,
  PatchType,
} from "../src/index.js";

describe("ConfigSchema", () => {
  it("applies defaults for empty input", () => {
    const cfg = ConfigSchema.parse({});
    expect(cfg.sunoBaseUrl).toBe("https://api.sunomusic.com");
    expect(cfg.dbPath).toBe("./data/track-forge.db");
    expect(cfg.logLevel).toBe("info");
    expect(cfg.port).toBe(3000);
    expect(cfg.llmProvider).toBe("openai");
    expect(cfg.llmModel).toBe("gpt-4o");
  });

  it("accepts valid overrides", () => {
    const cfg = ConfigSchema.parse({
      sunoBaseUrl: "https://custom-suno.example.com",
      sunoAuthToken: "test-token",
      publicBaseUrl: "https://app.example.com",
      dbPath: "/tmp/test.db",
      logLevel: "debug",
      port: 8080,
      llmProvider: "anthropic",
      llmApiKey: "sk-ant-xxx",
      llmModel: "claude-3-5-sonnet-20241022",
    });
    expect(cfg.sunoBaseUrl).toBe("https://custom-suno.example.com");
    expect(cfg.sunoAuthToken).toBe("test-token");
    expect(cfg.publicBaseUrl).toBe("https://app.example.com");
    expect(cfg.dbPath).toBe("/tmp/test.db");
    expect(cfg.logLevel).toBe("debug");
    expect(cfg.port).toBe(8080);
    expect(cfg.llmProvider).toBe("anthropic");
    expect(cfg.llmApiKey).toBe("sk-ant-xxx");
    expect(cfg.llmModel).toBe("claude-3-5-sonnet-20241022");
  });

  it("rejects invalid URL", () => {
    expect(() => ConfigSchema.parse({ sunoBaseUrl: "not-a-url" })).toThrow();
  });

  it("rejects bad log level", () => {
    expect(() => ConfigSchema.parse({ logLevel: "verbose" })).toThrow();
  });

  it("rejects non-positive port", () => {
    expect(() => ConfigSchema.parse({ port: -1 })).toThrow();
  });
});

describe("GenerationStage const map", () => {
  it("has all stages in order", () => {
    const stages = Object.values(GenerationStage);
    expect(stages).toContain("ref_interpretation");
    expect(stages).toContain("planning");
    expect(stages).toContain("style_writing");
    expect(stages).toContain("lyrics_writing");
    expect(stages).toContain("compilation");
    expect(stages).toContain("review");
    expect(stages).toContain("revision");
    expect(stages).toContain("verification");
    expect(stages).toContain("versioning");
    expect(stages.length).toBe(9);
  });
});

describe("JobStatus const map", () => {
  it("has expected statuses", () => {
    expect(JobStatus.Pending).toBe("pending");
    expect(JobStatus.InProgress).toBe("in_progress");
    expect(JobStatus.Completed).toBe("completed");
    expect(JobStatus.Failed).toBe("failed");
    expect(JobStatus.Cancelled).toBe("cancelled");
  });
});

describe("VersionStatus const map", () => {
  it("has draft and final", () => {
    expect(VersionStatus.Draft).toBe("draft");
    expect(VersionStatus.Final).toBe("final");
  });
});

describe("SunoArtifactType const map", () => {
  it("has 9 artifact types", () => {
    expect(Object.keys(SunoArtifactType)).toHaveLength(9);
    expect(SunoArtifactType.Title).toBe("title");
    expect(SunoArtifactType.Style).toBe("style");
    expect(SunoArtifactType.ExcludedStyles).toBe("excluded_styles");
    expect(SunoArtifactType.Lyrics).toBe("lyrics");
    expect(SunoArtifactType.Bpm).toBe("bpm");
    expect(SunoArtifactType.Key).toBe("key");
    expect(SunoArtifactType.VocalDescription).toBe("vocal_description");
    expect(SunoArtifactType.NegativeTags).toBe("negative_tags");
    expect(SunoArtifactType.PatchNotes).toBe("patch_notes");
  });
});

describe("CriticSeverity const map", () => {
  it("has error/warning/suggestion", () => {
    expect(CriticSeverity.Error).toBe("error");
    expect(CriticSeverity.Warning).toBe("warning");
    expect(CriticSeverity.Suggestion).toBe("suggestion");
  });
});

describe("AutoFixPolicy const map", () => {
  it("has required/preferred/skipped", () => {
    expect(AutoFixPolicy.Required).toBe("required");
    expect(AutoFixPolicy.Preferred).toBe("preferred");
    expect(AutoFixPolicy.Skipped).toBe("skipped");
  });
});

describe("PatchType const map", () => {
  it("has 12 patch types", () => {
    expect(Object.keys(PatchType)).toHaveLength(12);
    expect(PatchType.ReplaceStyleDescription).toBe("replace_style_description");
    expect(PatchType.ReplaceNegativeTags).toBe("replace_negative_tags");
    expect(PatchType.ReplaceLyricsSection).toBe("replace_lyrics_section");
    expect(PatchType.ReplaceSelectedText).toBe("replace_selected_text");
    expect(PatchType.InputPatch).toBe("input_patch");
    expect(PatchType.MergeField).toBe("merge_field");
    expect(PatchType.RemoveField).toBe("remove_field");
  });
});
