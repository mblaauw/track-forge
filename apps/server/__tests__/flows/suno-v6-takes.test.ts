/**
 * What actually reaches Suno when a take is rendered.
 *
 * The forge flow tests run with SUNO_DRY_RUN and never look at the request.
 * These capture the body handed to the Suno client and check it against the
 * v6 contract: model id, `lyrics` (not `prompt`), an explicit `duration`
 * derived from the arrangement, `variety` 0 by default, and per-take
 * settings from the request body.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { estimateDurationSec } from "@track-forge/contracts";
import type { TestEngineInstance } from "@track-forge/test-support";
import { createServerEngine } from "./create-server-engine.js";

const PIPELINE_TIMEOUT = 15_000;

function capturingSuno(submitImpl?: () => never) {
  const requests: Record<string, unknown>[] = [];
  return {
    requests,
    async submit(request: Record<string, unknown>) {
      requests.push(request);
      if (submitImpl) submitImpl();
      return {
        taskId: `captured-${requests.length}`,
        callbackConfigured: false,
      };
    },
    async getGenerationStatus() {
      return { id: "captured", status: "completed" };
    },
    async waitForCompletion() {
      return { id: "captured", status: "completed", tracks: [] };
    },
  };
}

const SECTIONS = [
  { id: "s1", name: "Intro", bars: 8, fn: "establish", deltas: [], tags: [] },
  { id: "s2", name: "Build", bars: 8, fn: "introduce", deltas: [], tags: [] },
  { id: "s3", name: "Drop", bars: 16, fn: "peak", deltas: [], tags: [] },
  { id: "s4", name: "Outro", bars: 8, fn: "resolve", deltas: [], tags: [] },
];

async function forge(
  engine: TestEngineInstance,
  inputs: Record<string, unknown>,
  presetId = "deep_house_chill",
  genreId = "edm",
) {
  const created = await engine.api.createJob({
    genreId,
    presetId,
    inputs,
  });
  expect(created.status).toBe(201);
  const jobId = created.body.id;
  await engine.api.startPipeline(jobId);
  const deadline = Date.now() + PIPELINE_TIMEOUT;
  let status = "";
  while (Date.now() < deadline) {
    status = (await engine.api.getJob(jobId)).body.status;
    if (status === "completed" || status === "failed") break;
    await new Promise((r) => setTimeout(r, 100));
  }
  expect(status).toBe("completed");
  const versions = await engine.api.listVersions(jobId);
  return versions.body[0]!;
}

describe("takes sent to Suno v6", () => {
  let engine: TestEngineInstance;
  let suno: ReturnType<typeof capturingSuno>;

  beforeEach(async () => {
    suno = capturingSuno();
    engine = await createServerEngine("suno-v6-takes", undefined, suno);
    // createServerEngine turns dry-run on; these tests need the real path.
    process.env.SUNO_DRY_RUN = "false";
  });

  afterEach(async () => {
    process.env.SUNO_DRY_RUN = "true";
    await engine.cleanup();
  });

  it(
    "sends an instrumental take with model, duration and exact variety",
    async () => {
      const version = await forge(engine, {
        bpm: 120,
        mood: "warm",
        energy: 6,
        complexity: 5,
        lyricsMode: "strict_instrumental",
        sections: SECTIONS,
      });

      const take = await engine.api.createTake(version.id);
      expect(take.status).toBe(201);
      expect(suno.requests).toHaveLength(1);
      const req = suno.requests[0]!;

      expect(req.model).toBe("V6");
      expect(req.customMode).toBe(true);
      expect(req.instrumental).toBe(true);
      expect(req.variety).toBe(0);
      // 40 bars of 4/4 at 120 BPM = 80 seconds.
      expect(req.duration).toBe(estimateDurationSec(120, SECTIONS));
      expect(req.duration).toBe(80);
      expect(req).not.toHaveProperty("prompt");
      expect(req.lyrics).toBeUndefined();
      // The real arrangement, not the preset's generic outline.
      expect(req.style).toContain("structure: intro → build → drop → outro");
      expect(String(req.negativeTags)).toContain("vocals");
    },
    PIPELINE_TIMEOUT + 5_000,
  );

  it(
    "applies per-take settings from the request body",
    async () => {
      const version = await forge(engine, {
        bpm: 120,
        mood: "warm",
        energy: 6,
        complexity: 5,
        lyricsMode: "strict_instrumental",
        sections: SECTIONS,
      });

      const take = await engine.api.createTake(version.id, {
        model: "V6_WILD",
        variety: 2,
        weirdness: 0.7,
        styleInfluence: 0.25,
      });
      expect(take.status).toBe(201);
      const req = suno.requests[0]!;
      expect(req.model).toBe("V6_WILD");
      expect(req.variety).toBe(2);
      expect(req.weirdnessConstraint).toBe(0.7);
      expect(req.styleWeight).toBe(0.25);

      // The take remembers what it was rendered with.
      const takes = await engine.api.listTakes(version.id);
      const stored = takes.body[0] as { renderSettings?: string };
      expect(JSON.parse(stored.renderSettings!)).toMatchObject({
        model: "V6_WILD",
        variety: 2,
        weirdness: 0.7,
        styleInfluence: 0.25,
        duration: 80,
      });
    },
    PIPELINE_TIMEOUT + 5_000,
  );

  it(
    "rejects a retired model id without calling Suno",
    async () => {
      const version = await forge(engine, {
        bpm: 120,
        mood: "warm",
        energy: 6,
        complexity: 5,
        lyricsMode: "strict_instrumental",
        sections: SECTIONS,
      });

      const take = await engine.api.createTake(version.id, {
        model: "V4_5ALL",
      });
      expect(take.status).toBe(400);
      expect(suno.requests).toHaveLength(0);
    },
    PIPELINE_TIMEOUT + 5_000,
  );

  it(
    "clamps an over-long arrangement to 360 seconds and records why",
    async () => {
      const long = [
        ...SECTIONS,
        {
          id: "s5",
          name: "Drop 2",
          bars: 200,
          fn: "peak",
          deltas: [],
          tags: [],
        },
      ];
      const version = await forge(engine, {
        bpm: 120,
        mood: "warm",
        energy: 6,
        complexity: 5,
        lyricsMode: "strict_instrumental",
        sections: long,
      });

      const take = await engine.api.createTake(version.id);
      expect(take.status).toBe(201);
      expect(suno.requests[0]!.duration).toBe(360);

      const takes = await engine.api.listTakes(version.id);
      const stored = takes.body[0] as { payloadWarnings?: string };
      expect(stored.payloadWarnings).toContain("at most 360s");
    },
    PIPELINE_TIMEOUT + 5_000,
  );

  it(
    "sends a vocal take with lyrics, the dominant voice and its gender",
    async () => {
      const vocal = {
        type: "Female lead",
        delivery: "Laid back",
        energy: 3,
        adlibs: false,
        harmonies: true,
      };
      // Section ids match the mock LLM's response (16 + 8 lines).
      const sections = [
        {
          id: "section-1",
          name: "Verse",
          fn: "introduce",
          bars: 16,
          deltas: ["vocal focus", "building"],
          vocal,
        },
        {
          id: "section-2",
          name: "Hook",
          fn: "peak",
          bars: 8,
          deltas: ["catchy", "climactic"],
          vocal: { ...vocal, delivery: "Powerful" },
        },
      ];
      const version = await forge(
        engine,
        {
          bpm: 90,
          mood: "confident",
          narrativeArc: "braggadocio",
          rhymeStyle: "end_rhyme",
          flowPattern: "laid_back",
          energy: 6,
          complexity: 5,
          lyricsMode: "full_lyrics",
          sections,
        },
        "boom_bap_classic",
        "hiphop",
      );

      const take = await engine.api.createTake(version.id);
      expect(take.status).toBe(201);
      const req = suno.requests[0]!;

      expect(req.instrumental).toBe(false);
      expect(req).not.toHaveProperty("prompt");
      expect(String(req.lyrics)).toContain("[Verse: vocal focus, building]");
      expect(String(req.lyrics)).toContain("[Hook: catchy, climactic]");
      expect(String(req.lyrics)).toContain("Test verse line 1");
      expect(req.vocalGender).toBe("f");
      // 24 bars of 4/4 at 90 BPM = 64 seconds.
      expect(req.duration).toBe(64);
      expect(req.style).toContain(
        "female lead vocals with a laid back delivery",
      );
      // Vocal takes carry the structure in the lyrics, not the style.
      expect(req.style).not.toContain("structure:");
    },
    PIPELINE_TIMEOUT + 5_000,
  );
});

describe("versions forged before durations were recorded", () => {
  it(
    "still sends a duration, worked out from the job's arrangement",
    async () => {
      const suno = capturingSuno();
      const engine = await createServerEngine(
        "suno-v6-legacy",
        undefined,
        suno,
      );
      process.env.SUNO_DRY_RUN = "false";
      try {
        const version = await forge(engine, {
          bpm: 120,
          mood: "warm",
          energy: 6,
          complexity: 5,
          lyricsMode: "strict_instrumental",
          sections: SECTIONS,
        });
        // Make it look like a pre-v6 version: no compilation link and no
        // duration in the compiled JSON the pipeline left on the job.
        const sqlite = (engine.db as any).$client;
        sqlite
          .prepare("UPDATE versions SET compilation_id = NULL WHERE id = ?")
          .run(version.id);
        sqlite
          .prepare("UPDATE jobs SET stage_data = NULL WHERE id = ?")
          .run(version.jobId);

        const take = await engine.api.createTake(version.id);
        expect(take.status).toBe(201);
        expect(suno.requests[0]!.duration).toBe(80);
      } finally {
        process.env.SUNO_DRY_RUN = "true";
        await engine.cleanup();
      }
    },
    PIPELINE_TIMEOUT + 5_000,
  );
});

describe("Suno failures", () => {
  it(
    "passes the provider's reason through to the caller",
    async () => {
      const { SunoApiError } = await import("@track-forge/core");
      const suno = capturingSuno(() => {
        throw new SunoApiError(429, "insufficient credits");
      });
      const engine = await createServerEngine("suno-v6-fail", undefined, suno);
      process.env.SUNO_DRY_RUN = "false";
      try {
        const version = await forge(engine, {
          bpm: 120,
          mood: "warm",
          energy: 6,
          complexity: 5,
          lyricsMode: "strict_instrumental",
          sections: SECTIONS,
        });
        const take = await engine.api.createTake(version.id);
        expect(take.status).toBe(502);
        expect((take.body as { error?: string }).error).toBe(
          "The Suno account is out of credits",
        );
      } finally {
        process.env.SUNO_DRY_RUN = "true";
        await engine.cleanup();
      }
    },
    PIPELINE_TIMEOUT + 5_000,
  );
});

describe("style preview", () => {
  it("reflects the session's own BPM, descriptors and arrangement", async () => {
    const engine = await createServerEngine("suno-v6-preview");
    try {
      const res = await engine.api.previewStyle({
        genreId: "edm",
        presetIds: ["chillout_relaxed"],
        descriptors: [{ label: "supersaw", cat: "sound", weight: 2 }],
        bpm: 96,
        sections: [
          { name: "Intro", fn: "establish", bars: 8 },
          { name: "Groove", fn: "peak", bars: 16 },
        ],
        lyricsMode: "strict_instrumental",
      });
      expect(res.status).toBe(200);
      // The preset says 90 BPM and a verse/chorus outline; the session wins.
      expect(res.body.style).toContain("around 96 BPM");
      expect(res.body.style).toContain("built around supersaw");
      expect(res.body.style).toContain("structure: intro → groove");
      expect(res.body.activeCount).toBe(1);
      expect(res.body.charCount).toBe(res.body.style.length);
    } finally {
      await engine.cleanup();
    }
  });

  it("names the voice the pipeline will send for a vocal session", async () => {
    const engine = await createServerEngine("suno-v6-preview-vocal");
    try {
      const vocal = {
        type: "Male lead",
        delivery: "Powerful",
        energy: 4,
        adlibs: false,
        harmonies: false,
      };
      const res = await engine.api.previewStyle({
        genreId: "edm",
        presetIds: ["dance_pop_catchy"],
        descriptors: [{ label: "supersaw", cat: "sound", weight: 2 }],
        bpm: 120,
        sections: [
          { name: "Verse", fn: "introduce", bars: 16, vocal },
          { name: "Chorus", fn: "peak", bars: 8, vocal },
        ],
        lyricsMode: "full_lyrics",
      });
      expect(res.status).toBe(200);
      expect(res.body.style).toContain(
        "male lead vocals with a powerful delivery",
      );
      expect(res.body.style).not.toContain("structure:");
    } finally {
      await engine.cleanup();
    }
  });
});
