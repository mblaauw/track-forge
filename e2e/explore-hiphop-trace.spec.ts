import { test } from "@playwright/test";
import { existsSync, readFileSync, readdirSync } from "node:fs";

test.describe("Hip-Hop lyrics trace exploration", () => {
  test("open the app in UI, then generate lyrics via API and inspect trace", async ({
    page,
  }) => {
    // ── 1. Load the app and screenshot initial state ────────────────
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    console.log("=== PAGE LOADED ===");

    // Get visible text summary
    const bodyText = await page.locator("body").innerText();
    console.log(bodyText);

    // ── 2. Now call the API directly with hip-hop params ────────────
    console.log("\n=== CALLING LYRICS GENERATION API ===");

    const traceBase = "data/lyrics-traces";

    // Build a realistic hip-hop request matching what the UI would send
    const body = {
      genreId: "hiphop",
      presetIds: ["trap_banger", "trap_dark"],
      descriptors: [
        { label: "hard 808s", cat: "rhythm", weight: 3 },
        { label: "dark", cat: "atmosphere", weight: 3 },
        { label: "aggressive", cat: "energy", weight: 2 },
        { label: "crisp", cat: "production", weight: 2 },
        { label: "minimal", cat: "sound", weight: 1 },
      ],
      bpm: 150,
      key: "C#",
      scale: "minor",
      style:
        "Hard 808s, crisp hi-hats, dark atmospheric pads, minimal melody, aggressive delivery.",
      sections: [
        {
          id: "s-intro",
          name: "Intro",
          bars: 4,
          fn: "establish",
          deltas: ["minimal", "instrumental"],
        },
        {
          id: "s-v1",
          name: "Verse 1",
          bars: 16,
          fn: "introduce",
          deltas: ["building"],
          vocal: {
            type: "Rapper",
            delivery: "rhythmic",
            energy: 3,
            adlibs: true,
            harmonies: false,
          },
        },
        {
          id: "s-hook",
          name: "Hook",
          bars: 8,
          fn: "peak",
          deltas: ["catchy"],
          vocal: {
            type: "Rapper",
            delivery: "melodic",
            energy: 4,
            adlibs: true,
            harmonies: true,
          },
        },
        {
          id: "s-v2",
          name: "Verse 2",
          bars: 16,
          fn: "escalate",
          deltas: ["intense"],
          vocal: {
            type: "Rapper",
            delivery: "aggressive",
            energy: 5,
            adlibs: true,
            harmonies: false,
          },
        },
        {
          id: "s-bridge",
          name: "Bridge",
          bars: 8,
          fn: "contrast",
          deltas: ["stripped back"],
          vocal: {
            type: "Singer",
            delivery: "smooth",
            energy: 2,
            adlibs: false,
            harmonies: true,
          },
        },
        {
          id: "s-outro",
          name: "Outro",
          bars: 4,
          fn: "resolve",
          deltas: ["minimal", "instrumental"],
        },
      ],
      lyricsMode: "full_lyrics",
      vocalType: "Rapper",
      lyricTopic: "street survival and ambition",
      lyricThemes: ["struggle", "hustle", "betrayal", "resilience"],
      lyricAngle: "story",
    };

    const res = await fetch("http://localhost:3000/api/lyrics/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const status = res.status;
    console.log(`API response status: ${status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(
        "API response:",
        JSON.stringify(data, null, 2).substring(0, 500),
      );
    } else {
      const errText = await res.text();
      console.log("API error:", errText.substring(0, 500));
    }

    // ── 3. Read the trace file ──────────────────────────────────────
    const files = existsSync(traceBase)
      ? readdirSync(traceBase).filter((f) => f.endsWith(".log"))
      : [];
    console.log(`\n=== TRACE FILES (${files.length}) ===`);
    for (const f of files.sort()) {
      console.log(`\n--- ${f} ---`);
      console.log(readFileSync(`${traceBase}/${f}`, "utf-8"));
    }
  });
});
