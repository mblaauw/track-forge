/**
 * Pre-built test scenarios combining FakeLlmServer and FakeSunoServer.
 *
 * Each scenario provides a complete deterministic environment for
 * end-to-end testing of the Forge → Take → Render flow.
 */

import { createFakeLlmServer, type FakeLlmServer } from "./fake-llm-server.js";
import {
  createFakeSunoServer,
  type FakeSunoServer,
} from "./fake-suno-server.js";

export interface TestScenario {
  name: string;
  llm: FakeLlmServer;
  suno: FakeSunoServer;
}

/**
 * Successful instrumental forge: no LLM call, Suno submits and completes.
 */
export function instrumentalSuccess(): TestScenario {
  return {
    name: "instrumental-success",
    llm: createFakeLlmServer({ scenario: "success" }),
    suno: createFakeSunoServer({ scenario: "success" }),
  };
}

/**
 * Successful vocal forge: LLM returns lyrics, Suno submits and completes.
 */
export function vocalSuccess(): TestScenario {
  return {
    name: "vocal-success",
    llm: createFakeLlmServer({
      scenario: "success",
      lyricsContent: `[Verse 1]
Testing vocal generation flow.
With structured lyrics content.

[Chorus]
Hook line repeats for the chorus.
Building energy in the track.

[Verse 2]
Second verse development.
Leading to the final build.

[Outro]
Fading out the vocal track.`,
    }),
    suno: createFakeSunoServer({ scenario: "success" }),
  };
}

/**
 * Ambient forge: EDM-style but ambient genre, vocal.
 */
export function ambientSuccess(): TestScenario {
  return {
    name: "ambient-success",
    llm: createFakeLlmServer({
      scenario: "success",
      lyricsContent: `[Intro]
Evolving atmospheric pad.
Space grows slowly.

[Section A]
Textures layer and shift.
Drone harmonics emerge.

[Section B]
Gentle pulse enters.
Wash of reverb.

[Outro]
Fading into silence.`,
    }),
    suno: createFakeSunoServer({
      scenario: "success",
      generationId: "ambient-mock",
    }),
  };
}

/**
 * LLM call fails with timeout
 */
export function llmTimeout(): TestScenario {
  return {
    name: "llm-timeout",
    llm: createFakeLlmServer({ scenario: "timeout" }),
    suno: createFakeSunoServer({ scenario: "success" }),
  };
}

/**
 * LLM returns malformed/unparseable lyrics
 */
export function llmMalformed(): TestScenario {
  return {
    name: "llm-malformed",
    llm: createFakeLlmServer({ scenario: "malformed" }),
    suno: createFakeSunoServer({ scenario: "success" }),
  };
}

/**
 * Suno submission fails
 */
export function sunoSubmitFails(): TestScenario {
  return {
    name: "suno-submit-fails",
    llm: createFakeLlmServer({ scenario: "success" }),
    suno: createFakeSunoServer({ scenario: "submit_fails" }),
  };
}

/**
 * Suno polls pending then completes
 */
export function sunoPendingThenComplete(): TestScenario {
  return {
    name: "suno-pending-then-complete",
    llm: createFakeLlmServer({ scenario: "success" }),
    suno: createFakeSunoServer({
      scenario: "pending_then_complete",
      pollDelayMs: 10,
    }),
  };
}

/**
 * Suno polls pending then fails
 */
export function sunoPendingThenFailed(): TestScenario {
  return {
    name: "suno-pending-then-failed",
    llm: createFakeLlmServer({ scenario: "success" }),
    suno: createFakeSunoServer({
      scenario: "pending_then_failed",
      pollDelayMs: 10,
    }),
  };
}

/**
 * Suno callback arrives before first poll
 */
export function sunoCallbackBeforePoll(): TestScenario {
  return {
    name: "suno-callback-before-poll",
    llm: createFakeLlmServer({ scenario: "success" }),
    suno: createFakeSunoServer({ scenario: "callback_before_poll" }),
  };
}

/**
 * Cancelled job: forge starts but is cancelled mid-stream
 */
export function jobCancelled(): TestScenario {
  return {
    name: "job-cancelled",
    llm: createFakeLlmServer({ scenario: "success", delayMs: 500 }),
    suno: createFakeSunoServer({ scenario: "success" }),
  };
}

// ── Scenario registry ──────────────────────────────────────────────────

export const ALL_SCENARIOS: Record<string, () => TestScenario> = {
  "instrumental-success": instrumentalSuccess,
  "vocal-success": vocalSuccess,
  "ambient-success": ambientSuccess,
  "llm-timeout": llmTimeout,
  "llm-malformed": llmMalformed,
  "suno-submit-fails": sunoSubmitFails,
  "suno-pending-then-complete": sunoPendingThenComplete,
  "suno-pending-then-failed": sunoPendingThenFailed,
  "suno-callback-before-poll": sunoCallbackBeforePoll,
  "job-cancelled": jobCancelled,
};

export function getScenario(name: string): TestScenario {
  const factory = ALL_SCENARIOS[name];
  if (!factory) throw new Error(`Unknown scenario: ${name}`);
  return factory();
}

export function listScenarios(): string[] {
  return Object.keys(ALL_SCENARIOS);
}
