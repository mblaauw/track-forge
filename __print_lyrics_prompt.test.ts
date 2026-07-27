import { describe, it, expect } from "vitest";
import { buildLyricsPrompt } from "./packages/core/src/llm/lyrics-writer.js";
import type { LyricsWriterInput } from "./packages/core/src/llm/lyrics-writer.js";

const COMMON_VOCAL = {
  type: "Rapper",
  delivery: "rhythmic",
  energy: 4,
  adlibs: true,
  harmonies: false,
};

const hipHopInput: LyricsWriterInput = {
  genreName: "Hip-hop",
  presetLabels: ["Trap", "Dark Trap"],
  bpm: 140,
  key: "C#",
  scale: "minor",
  mood: "dark",
  energy: 9,
  narrativeArc: "braggadocio",
  rhymeStyle: "multi_syllabic",
  flowPattern: "aggressive",
  vocalStyle: "rhythmic, triplet flows with ad-libs",
  tempoFeel: "half_time",
  perceivedBpm: 70,
  lineDensity: 1,
  perspective: "first_person",
  lyricsGuidance: "Hip-hop lyrics must work as performed music, not merely as written poetry.",
  lyricTopic: "street life",
  lyricAngle: "story",
  lyricThemes: ["struggle", "ambition"],
  characteristics: ["808 bass", "dark"],
  sections: [
    { id: "sec-intro", name: "Intro", bars: 4, fn: "establish", deltas: ["minimal"], vocal: undefined },
    { id: "sec-v1", name: "Verse 1", bars: 16, fn: "introduce", deltas: ["building"], vocal: COMMON_VOCAL },
    { id: "sec-hook", name: "Hook", bars: 8, fn: "peak", deltas: ["catchy"], vocal: COMMON_VOCAL },
    { id: "sec-v2", name: "Verse 2", bars: 16, fn: "escalate", deltas: ["intense"], vocal: COMMON_VOCAL },
    { id: "sec-outro", name: "Outro", bars: 4, fn: "resolve", deltas: ["minimal"], vocal: undefined },
  ],
};

describe("dump hip-hop prompt", () => {
  it("prints the full prompt to stdout", () => {
    const { system, user } = buildLyricsPrompt(hipHopInput);
    console.log("\n═══ SYSTEM PROMPT ═══\n");
    console.log(system);
    console.log("\n═══ USER PROMPT ═══\n");
    console.log(user);
    expect(system).toBeTruthy();
  });
});
