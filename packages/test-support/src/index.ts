import type { GenreModule } from "@track-forge/genre-core";

/** Shared mock LLM that returns a canned response */
export function mockLlm(response?: string) {
  const content = response ?? "Mock analysis result for testing.";
  return {
    async complete() {
      return {
        content,
        model: "mock",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    },
  };
}

/** Shared mock Suno client */
export function mockSuno() {
  return {
    async submit() {
      return { ids: ["mock-id"], callbackConfigured: false };
    },
    async getGenerationStatus() {
      return {
        id: "mock-id",
        status: "completed" as const,
        audioUrl: "https://example.com/audio.mp3",
      };
    },
    async waitForCompletion() {
      return {
        id: "mock-id",
        status: "completed" as const,
        audioUrl: "https://example.com/audio.mp3",
      };
    },
  };
}

/** Shared minimal mock genre module for pipeline testing */
export function mockGenreModule(overrides?: Partial<GenreModule>): GenreModule {
  return {
    id: "test-genre",
    name: "Test Genre",
    inputSchema: null as any,
    blueprintSchema: null as any,
    defaults: {},
    form: [],
    adjustmentVocabulary: {
      styleTerms: [],
      structureTerms: [],
      deliveryTerms: [],
    },
    tagPolicy: { mandatoryTags: [], forbiddenTags: [], canonicalMap: {} },
    presets: [],
    promptFragments: {},
    renderers: {
      title: () => "Mock Title",
      style: () => "Mock style description with 120 BPM",
      excludedStyles: () => "slow, ballad",
      lyrics: () => "[Intro]\n(instrumental)\n\n[Verse]\nLyrics here",
    },
    critics: {
      fast: { id: "fast-panel", promptTemplate: "Review this song" },
      full: [],
    },
    validators: {
      input: () => [],
      blueprint: () => [],
    },
    compileBlueprint: (inputs) => inputs as Record<string, unknown>,
    migrations: [],
    ...overrides,
  };
}
