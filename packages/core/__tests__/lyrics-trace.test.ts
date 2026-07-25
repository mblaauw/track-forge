import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeLyrics,
  writeLyricsTrace,
  buildLyricsPrompt,
} from "../src/llm/index.js";
import type { LyricsWriterInput, LyricsLlm } from "../src/llm/index.js";

function fakeLlm(response?: string): LyricsLlm {
  const content =
    response ??
    JSON.stringify({
      sections: [
        { id: "sec-1", lines: ["First test line.", "Second test line."] },
        { id: "sec-2", lines: ["Hook line one.", "Hook line two."] },
      ],
    });
  return {
    async complete() {
      return {
        content,
        model: "test-mock",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    },
  };
}

const COMMON_VOCAL = {
  type: "Rapper",
  delivery: "rhythmic",
  energy: 4,
  adlibs: true,
  harmonies: false,
};

function hipHopInput(
  overrides?: Partial<LyricsWriterInput>,
): LyricsWriterInput {
  return {
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
    lyricsGuidance:
      "Hip-hop lyrics must work as performed music, not merely as written poetry.",
    sections: [
      {
        id: "sec-intro",
        name: "Intro",
        bars: 4,
        fn: "establish",
        deltas: ["minimal"],
        vocal: undefined,
      },
      {
        id: "sec-v1",
        name: "Verse 1",
        bars: 16,
        fn: "introduce",
        deltas: ["building"],
        vocal: COMMON_VOCAL,
      },
      {
        id: "sec-hook",
        name: "Hook",
        bars: 8,
        fn: "peak",
        deltas: ["catchy"],
        vocal: COMMON_VOCAL,
      },
      {
        id: "sec-v2",
        name: "Verse 2",
        bars: 16,
        fn: "escalate",
        deltas: ["intense"],
        vocal: COMMON_VOCAL,
      },
      {
        id: "sec-outro",
        name: "Outro",
        bars: 4,
        fn: "resolve",
        deltas: ["minimal"],
        vocal: undefined,
      },
    ],
    ...overrides,
  };
}

function edmInput(overrides?: Partial<LyricsWriterInput>): LyricsWriterInput {
  return {
    genreName: "EDM",
    presetLabels: ["Dance-Pop — Catchy"],
    bpm: 118,
    key: "C",
    scale: "major",
    mood: "catchy and upbeat",
    energy: 7,
    narrativeArc: "storytelling",
    tempoFeel: "straight",
    perceivedBpm: 118,
    lineDensity: 0.5,
    perspective: "first_person",
    lyricsGuidance:
      "EDM lyrics are written for repetition, emotional lift, and physical delivery.",
    lyricTopic: "summer love",
    lyricThemes: ["joy", "freedom"],
    lyricAngle: "story",
    sections: [
      {
        id: "s-intro",
        name: "Intro",
        bars: 8,
        fn: "establish",
        deltas: ["atmospheric", "instrumental"],
      },
      {
        id: "s-v1",
        name: "Verse 1",
        bars: 16,
        fn: "introduce",
        deltas: ["building"],
        vocal: {
          type: "Female lead",
          delivery: "smooth",
          energy: 3,
          adlibs: false,
          harmonies: false,
        },
      },
      {
        id: "s-hook",
        name: "Chorus",
        bars: 16,
        fn: "peak",
        deltas: ["catchy", "full"],
        vocal: {
          type: "Female lead",
          delivery: "powerful",
          energy: 5,
          adlibs: false,
          harmonies: true,
        },
      },
      {
        id: "s-v2",
        name: "Verse 2",
        bars: 16,
        fn: "introduce",
        deltas: ["building"],
        vocal: {
          type: "Female lead",
          delivery: "smooth",
          energy: 3,
          adlibs: false,
          harmonies: false,
        },
      },
      {
        id: "s-outro",
        name: "Outro",
        bars: 8,
        fn: "resolve",
        deltas: ["stripped back", "instrumental"],
      },
    ],
    ...overrides,
  };
}

// ── Suite ────────────────────────────────────────────────────────────────

describe("Lyrics prompt and trace", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tf-lyrics-trace-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Hip-hop prompt structure ──────────────────────────────────────

  it("builds hip-hop system prompt with lyrical direction blocks", () => {
    const input = hipHopInput({
      lyricTopic: "street life",
      lyricAngle: "story",
      lyricThemes: ["struggle"],
      characteristics: ["808 bass", "dark"],
    });
    const { system } = buildLyricsPrompt(input);

    expect(system).toContain("Hip-hop genre (Trap, Dark Trap)");
    expect(system).toContain("Hip-hop lyrics must work as performed music");
    expect(system).toContain("NARRATIVE ARC: braggadocio narrative");
    expect(system).toContain(
      "FLOW & RHYME: Use a aggressive flow with multi syllabic rhyme patterns",
    );
    expect(system).toContain("MOOD & ENERGY: dark, 9/10 — explosive energy");
    expect(system).toContain(
      "VOCAL STYLE: rhythmic, triplet flows with ad-libs.",
    );
    expect(system).toContain("CHARACTER: 808 bass, dark.");
    expect(system).toContain("PERSPECTIVE: first person.");
    expect(system).toContain(
      "Tempo: 140 BPM, performed with a half-time pulse felt around 70 BPM.",
    );
    expect(system).toContain("OUTPUT FORMAT:");

    // When narrativeArc is set, the "story" angle instruction is suppressed
    expect(system).not.toContain("Write as a narrative");
    // No key/scale in lyrical prompt
    expect(system).not.toContain("BPM in C# minor");
    // No STYLE block
    expect(system).not.toMatch(/^STYLE:/m);
  });

  it("builds hip-hop user prompt with correct 1:1 line ratio", () => {
    const input = hipHopInput();
    const { user } = buildLyricsPrompt(input);

    expect(user).toContain("target ~16 lyric lines"); // 16 bars × 1.0 density
    expect(user).toContain("target ~8 lyric lines"); // 8 bars × 1.0
    // Instrumental section has no target line count
    const introPart = user.split("sec-intro")[1]?.split("sec-v1")[0] ?? "";
    expect(introPart).toContain("instrumental");
    expect(introPart).not.toContain("target");

    expect(user).toContain(
      "purpose: introduce the narrator, the encounter, and the initial attraction",
    );
    // Verse 2 has a different purpose
    expect(user).toContain("advance the story, deepen emotional stakes");
    // Hook structure
    expect(user).toContain("four-line core with one repeat");
    expect(user).toContain("vocal: Rapper, rhythmic, powerful, ad-libs");

    // No old format
    expect(user).not.toContain('id="');
    expect(user).not.toContain("function=");
    expect(user).not.toContain("STYLE:");
  });

  // ── EDM prompt structure ─────────────────────────────────────────

  it("builds EDM system prompt without rap-specific blocks", () => {
    const input = edmInput();
    const { system } = buildLyricsPrompt(input);

    expect(system).toContain("EDM genre (Dance-Pop — Catchy)");
    expect(system).toContain("EDM lyrics are written for repetition");
    expect(system).toContain("NARRATIVE ARC: storytelling narrative");
    expect(system).toContain(
      "MOOD & ENERGY: catchy and upbeat, 7/10 — high energy",
    );
    expect(system).toContain("PERSPECTIVE: first person.");
    expect(system).toContain(
      "Tempo: 118 BPM, performed with a straight pulse felt around 118 BPM.",
    );

    // No rap blocks
    expect(system).not.toContain("FLOW & RHYME:");
    expect(system).not.toContain("VOCAL STYLE:");
    // No duplicate story narrative
    expect(system).not.toContain("Write as a narrative");
    expect(system).not.toContain("BPM in C major");
  });

  it("builds EDM user prompt with 0.5 line density", () => {
    const input = edmInput();
    const { user } = buildLyricsPrompt(input);

    // 16 bars × 0.5 = 8 lines
    expect(user).toContain("target ~8 lyric lines");
    // 8 bars × 0.5 = 4 lines
    expect(user).not.toContain("target ~16 lyric lines");
    expect(user).not.toContain("target ~4 lyric lines");

    // Verse 1 vs Verse 2 different purposes
    expect(user).toContain(
      "introduce the narrator, the encounter, and the initial attraction",
    );
    expect(user).toContain(
      "advance the story, deepen emotional stakes, or introduce a turn",
    );

    // No rhyme on instrumental sections
    const introSection = user.split("s-intro")[1]?.split("s-v1")[0] ?? "";
    expect(introSection).not.toContain("rhyme:");

    // Chorus structure
    expect(user).toContain(
      "four-line core repeated twice; preserve the central hook line exactly",
    );
    expect(user).toContain("language:");
    expect(user).toContain(
      "vocal: Female lead, powerful, explosive, harmonies",
    );

    // Narrative progression block
    expect(user).toContain("NARRATIVE PROGRESSION:");
    expect(user).toContain("Intro: establish the mood");
    expect(user).toContain("Verse 1: introduce the narrator");
    expect(user).toContain("Verse 2: advance the story");

    // Brief and themes
    expect(user).toContain("BRIEF: summer love");
    expect(user).toContain("THEMES: joy, freedom");
    expect(user).toContain("PERSPECTIVE: first person.");
  });

  // ── Shared behavior ──────────────────────────────────────────────

  it("includes brief and themes", () => {
    const input = hipHopInput({
      lyricTopic: "city nights",
      lyricThemes: ["urban"],
    });
    const { user } = buildLyricsPrompt(input);
    expect(user).toContain("BRIEF: city nights");
    expect(user).toContain("THEMES: urban");
  });

  it("includes image anchors when provided", () => {
    const input = edmInput({ imageAnchors: ["warm pavement", "salt on skin"] });
    const { user } = buildLyricsPrompt(input);
    expect(user).toContain("IMAGES: warm pavement, salt on skin");
  });

  it("omits all lyrical direction blocks when params not set", () => {
    const input = hipHopInput({
      narrativeArc: undefined,
      rhymeStyle: undefined,
      flowPattern: undefined,
      mood: undefined,
      energy: undefined,
      vocalStyle: undefined,
      characteristics: undefined,
      tempoFeel: undefined,
      perceivedBpm: undefined,
      perspective: undefined,
      lineDensity: undefined,
    });
    const { system } = buildLyricsPrompt(input);
    expect(system).not.toContain("NARRATIVE ARC:");
    expect(system).not.toContain("FLOW & RHYME:");
    expect(system).not.toContain("MOOD & ENERGY:");
    expect(system).not.toContain("VOCAL STYLE:");
    expect(system).not.toContain("CHARACTER:");
    expect(system).not.toContain("Tempo:");
    expect(system).not.toContain("PERSPECTIVE:");
  });

  // ── Trace file tests ─────────────────────────────────────────────

  it("writes hip-hop trace file", async () => {
    const input = hipHopInput({
      lyricTopic: "street life",
      lyricAngle: "story",
      lyricThemes: ["struggle", "ambition"],
    });
    await writeLyrics(fakeLlm(), input, { traceDir: tmpDir });

    const files = readdirSync(tmpDir);
    expect(files).toHaveLength(1);
    const content = readFileSync(join(tmpDir, files[0]!), "utf-8");
    expect(content).toContain("Genre: Hip-hop");
    expect(content).toContain("BPM: 140");
    expect(content).toContain("Tempo feel: half_time");
    expect(content).toContain("Perceived BPM: 70");
    expect(content).toContain("Line density: 1");
    expect(content).toContain("Perspective: first_person");
    expect(content).toContain("Narrative arc: braggadocio");
    expect(content).toContain("Flow: aggressive");
    expect(content).toContain("─── SYSTEM PROMPT ─────────────────────");
    expect(content).toContain("─── USER PROMPT ───────────────────────");
  });

  it("writes EDM trace file", async () => {
    const input = edmInput({ lyricTopic: "summer love" });
    await writeLyrics(fakeLlm(), input, { traceDir: tmpDir });

    const files = readdirSync(tmpDir);
    expect(files).toHaveLength(1);
    const content = readFileSync(join(tmpDir, files[0]!), "utf-8");
    expect(content).toContain("Genre: EDM");
    expect(content).toContain("BPM: 118");
    expect(content).toContain("Tempo feel: straight");
    expect(content).toContain("Perceived BPM: 118");
    expect(content).toContain("Line density: 0.5");
    expect(content).toContain("Perspective: first_person");
    expect(content).toContain("Narrative arc: storytelling");
  });

  it("filename contains genre and preset slug", async () => {
    const input = hipHopInput({ presetLabels: ["Trap", "Dark Trap"] });
    await writeLyrics(fakeLlm(), input, { traceDir: tmpDir });
    const files = readdirSync(tmpDir);
    expect(files[0]!).toMatch(/^hip-hop_trap-dark-trap_.+\.log$/);
  });
});
