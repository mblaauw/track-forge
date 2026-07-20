/**
 * Fake Suno server for deterministic testing.
 *
 * Scenarios:
 * - success: submit returns ID, polls complete with audio URL
 * - pending_then_complete: first poll returns pending, second returns complete
 * - pending_then_failed: first poll returns pending, second returns failed
 * - submit_fails: submit() throws
 * - callback_before_poll: callback arrives before poll starts
 * - duplicate_callback: callback called twice with same ID
 * - invalid_response: submit returns malformed response
 */

export type FakeSunoScenario =
  | "success"
  | "pending_then_complete"
  | "pending_then_failed"
  | "submit_fails"
  | "invalid_response"
  | "callback_before_poll"
  | "duplicate_callback";

export interface FakeSunoServerConfig {
  scenario: FakeSunoScenario;
  pollDelayMs?: number;
  audioUrl?: string;
  errorMessage?: string;
  generationId?: string;
}

const DEFAULT_AUDIO_URL = "https://cdn.example.com/tracks/mock-audio.mp3";

export function createFakeSunoServer(config?: Partial<FakeSunoServerConfig>) {
  const cfg: FakeSunoServerConfig = {
    scenario: "success",
    pollDelayMs: 0,
    audioUrl: DEFAULT_AUDIO_URL,
    errorMessage: "Mock Suno error: generation failed",
    generationId: "mock-suno-id",
    ...config,
  };

  const tasks = new Map<
    string,
    { status: string; audioUrl: string | null; error?: string }
  >();
  const callbacks: Array<{
    id: string;
    status: string;
    audioUrl: string | null;
  }> = [];
  let submitCount = 0;
  let pollCount = 0;

  function createTask(id: string) {
    switch (cfg.scenario) {
      case "pending_then_complete":
        tasks.set(id, { status: "pending", audioUrl: null });
        break;
      case "pending_then_failed":
        tasks.set(id, { status: "pending", audioUrl: null, error: undefined });
        break;
      default:
        tasks.set(id, { status: "completed", audioUrl: cfg.audioUrl! });
        break;
    }
  }

  return {
    /** Submit a generation request */
    async submit(): Promise<{
      taskId: string;
      callbackConfigured: boolean;
    }> {
      submitCount++;
      const id = `${cfg.generationId}-${submitCount}`;

      switch (cfg.scenario) {
        case "submit_fails":
          throw new Error(cfg.errorMessage);

        case "invalid_response":
          return { taskId: "", callbackConfigured: false };

        case "callback_before_poll":
          // Task completes immediately and callback fires
          tasks.set(id, { status: "completed", audioUrl: cfg.audioUrl! });
          callbacks.push({ id, status: "completed", audioUrl: cfg.audioUrl! });
          return { taskId: id, callbackConfigured: true };

        case "duplicate_callback":
          tasks.set(id, { status: "completed", audioUrl: cfg.audioUrl! });
          callbacks.push({ id, status: "completed", audioUrl: cfg.audioUrl! });
          callbacks.push({ id, status: "completed", audioUrl: cfg.audioUrl! });
          return { taskId: id, callbackConfigured: true };

        default:
          createTask(id);
          return { taskId: id, callbackConfigured: false };
      }
    },

    /** Poll generation status */
    async getGenerationStatus(id: string): Promise<{
      id: string;
      status: string;
      audioUrl: string | null;
      error?: string;
    }> {
      pollCount++;
      const task = tasks.get(id);
      if (!task) {
        throw new Error(`Unknown task: ${id}`);
      }

      if (task.status === "pending") {
        const delay = cfg.pollDelayMs ?? 0;
        if (delay > 0 && pollCount < 3) {
          // still pending
          return { id, status: "pending", audioUrl: null };
        }
        // transition
        if (cfg.scenario === "pending_then_failed") {
          task.status = "failed";
          task.error = cfg.errorMessage;
        } else {
          task.status = "completed";
          task.audioUrl = cfg.audioUrl!;
        }
      }

      return {
        id,
        status: task.status,
        audioUrl: task.audioUrl,
        ...(task.error ? { error: task.error } : {}),
      };
    },

    /** Wait for completion via polling */
    async waitForCompletion(id: string): Promise<{
      id: string;
      status: string;
      audioUrl: string | null;
      error?: string;
    }> {
      const maxAttempts = 5;
      for (let i = 0; i < maxAttempts; i++) {
        const result = await this.getGenerationStatus(id);
        if (result.status === "completed" || result.status === "failed") {
          return result;
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      return {
        id,
        status: "timeout",
        audioUrl: null,
        error: "Max poll attempts exceeded",
      };
    },

    /** Simulate a callback from Suno */
    async triggerCallback(id: string, status: string): Promise<void> {
      const task = tasks.get(id);
      if (task) {
        task.status = status;
        if (status === "completed") task.audioUrl = cfg.audioUrl!;
        if (status === "failed") task.error = cfg.errorMessage;
      }
      callbacks.push({
        id,
        status,
        audioUrl: status === "completed" ? cfg.audioUrl! : null,
      });
    },

    /** Get recorded callbacks */
    getCallbacks(): Array<{
      id: string;
      status: string;
      audioUrl: string | null;
    }> {
      return [...callbacks];
    },

    /** Submit count */
    getSubmitCount(): number {
      return submitCount;
    },

    /** Poll count */
    getPollCount(): number {
      return pollCount;
    },

    /** Reset state */
    reset(): void {
      tasks.clear();
      callbacks.length = 0;
      submitCount = 0;
      pollCount = 0;
    },
  };
}

export type FakeSunoServer = ReturnType<typeof createFakeSunoServer>;
