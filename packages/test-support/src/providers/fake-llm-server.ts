/**
 * Fake LLM server for deterministic testing.
 *
 * Scenarios:
 * - success: returns canned lyric response
 * - malformed: returns unparseable content
 * - timeout: throws after configurable delay
 * - empty: returns empty content
 */

export type FakeLlmScenario = "success" | "malformed" | "timeout" | "empty";

export interface FakeLlmServerConfig {
  scenario: FakeLlmScenario;
  delayMs?: number;
  lyricsContent?: string;
  model?: string;
}

const DEFAULT_LYRICS = `[Verse 1]
Test verse lyrics for verification.

[Chorus]
Test chorus hook repeat.

[Verse 2]
Second verse test lyrics.

[Outro]
Fade out test.`;

export function createFakeLlmServer(config?: Partial<FakeLlmServerConfig>) {
  const cfg: FakeLlmServerConfig = {
    scenario: "success",
    delayMs: 0,
    lyricsContent: DEFAULT_LYRICS,
    model: "fake-llm",
    ...config,
  };

  let callCount = 0;

  return {
    /**
     * Simulate an LLM completion call.
     * Returns a response shaped like an LLM provider response.
     */
    async complete(prompt?: string): Promise<{
      content: string;
      model: string;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }> {
      callCount++;
      const delay = cfg.delayMs ?? 0;

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      switch (cfg.scenario) {
        case "timeout":
          throw new Error("LLM timeout: request exceeded max duration");

        case "empty":
          return {
            content: "",
            model: cfg.model!,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          };

        case "malformed":
          return {
            content: "This is not valid lyrics format -- no structure markers",
            model: cfg.model!,
            usage: {
              promptTokens: prompt?.length ?? 0,
              completionTokens: 20,
              totalTokens: (prompt?.length ?? 0) + 20,
            },
          };

        case "success":
        default:
          return {
            content: cfg.lyricsContent!,
            model: cfg.model!,
            usage: {
              promptTokens: prompt?.length ?? 0,
              completionTokens: cfg.lyricsContent!.length,
              totalTokens: (prompt?.length ?? 0) + cfg.lyricsContent!.length,
            },
          };
      }
    },

    /** Number of times complete() was called */
    getCallCount(): number {
      return callCount;
    },

    /** Update scenario mid-test */
    setScenario(scenario: FakeLlmScenario): void {
      cfg.scenario = scenario;
    },

    /** Reset call counter */
    reset(): void {
      callCount = 0;
    },
  };
}

export type FakeLlmServer = ReturnType<typeof createFakeLlmServer>;
