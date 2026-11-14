import { describe, it, expect } from "vitest";
import { generateSunoPayload, payloadToLog } from "../src/suno/payload.js";
import type { SunoPayloadInput } from "../src/suno/payload.js";
import { getCapabilities } from "../src/suno/capabilities.js";
import type { SunoCapabilities } from "../src/suno/capabilities.js";

// ── Helpers ──────────────────────────────────────────────────────────

const MIN_INPUT: SunoPayloadInput = {
  title: "My Track",
  style: "Deep house with warm pads and groovy bassline",
  excludedStyles: "slow, ballad",
  lyrics: "[Intro]\n(atmospheric pads)\n\n[Drop]\n(groovy beat)",
  durationSec: 180,
};

// ── Tests ────────────────────────────────────────────────────────────

describe("generateSunoPayload", () => {
  it("produces a valid SunoGenerateRequest from minimal input", () => {
    const { request, warnings } = generateSunoPayload(MIN_INPUT);

    expect(request.title).toBe("My Track");
    expect(request.style).toContain("Deep house");
    expect(request.lyrics).toContain("[Intro]");
    // v6 reads the dedicated lyrics field; the legacy prompt field is gone.
    expect(request).not.toHaveProperty("prompt");
    expect(request.duration).toBe(180);
    expect(request.variety).toBe(0);
    expect(request.negativeTags).toBe("slow, ballad");
    expect(request.instrumental).toBe(false);
    expect(request.customMode).toBe(true);
    expect(request.model).toBe("V6");
    expect(warnings).toHaveLength(0);
  });

  it("sets instrumental=true when lyrics are empty", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      lyrics: "",
    });

    expect(request.instrumental).toBe(true);
    expect(request.lyrics).toBeUndefined();
  });

  it("sets instrumental=true when lyrics are whitespace only", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      lyrics: "   \n  \t  ",
    });

    expect(request.instrumental).toBe(true);
  });

  it("omits negativeTags when excludedStyles is empty", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      excludedStyles: "",
    });

    expect(request.negativeTags).toBeUndefined();
  });

  it("includes negativeTags (all models support them)", () => {
    const caps = getCapabilities("V6_MINI");
    const { request } = generateSunoPayload(MIN_INPUT, caps);

    expect(request.negativeTags).toBe("slow, ballad");
  });

  it("truncates style when exceeding max length", () => {
    const input: SunoPayloadInput = {
      ...MIN_INPUT,
      style: "X".repeat(3000),
    };
    const { request, warnings } = generateSunoPayload(input);

    expect(request.style.length).toBe(1000);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe("style");
  });

  it("truncates lyrics when exceeding max length", () => {
    const input: SunoPayloadInput = {
      ...MIN_INPUT,
      lyrics: "X".repeat(6000),
    };
    const { request, warnings } = generateSunoPayload(input);

    expect(request.lyrics!.length).toBe(5000);
    expect(warnings.some((w) => w.field === "lyrics")).toBe(true);
  });

  it("truncates negativeTags when exceeding max length", () => {
    const input: SunoPayloadInput = {
      ...MIN_INPUT,
      excludedStyles: "X".repeat(1500),
    };
    const caps = getCapabilities("V6");
    const { request, warnings } = generateSunoPayload(input, caps);

    expect(request.negativeTags?.length).toBe(1000);
    expect(warnings.some((w) => w.field === "negativeTags")).toBe(true);
  });

  it("uses default title when title is empty", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      title: "",
    });

    expect(request.title).toBe("Untitled");
  });

  it("honours explicit model version", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      modelVersion: "V6_WILD",
    });

    expect(request.model).toBe("V6_WILD");
  });

  it("passes through callbackUrl when capabilities support it", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      callbackUrl: "https://example.com/callback",
    });

    expect(request.callBackUrl).toBe("https://example.com/callback");
  });

  it("strips callbackUrl when capabilities do not support it", () => {
    const caps: SunoCapabilities = {
      maxLyricsLength: 5000,
      maxStyleLength: 1000,
      maxTitleLength: 80,
      maxNegativeTagsLength: 1000,
      minDurationSec: 10,
      maxDurationSec: 360,
      supportsNegativeTags: true,
      supportsCallbacks: false,
      maxBatchSize: 1,
    };
    const { request } = generateSunoPayload(
      {
        ...MIN_INPUT,
        callbackUrl: "https://example.com/callback",
      },
      caps,
    );

    expect(request.callBackUrl).toBeUndefined();
  });

  it("returns empty warnings for well-formed input", () => {
    const { warnings } = generateSunoPayload(MIN_INPUT);

    expect(warnings).toHaveLength(0);
  });

  it("returns warnings for multiple truncations", () => {
    const input: SunoPayloadInput = {
      ...MIN_INPUT,
      style: "X".repeat(3000),
      lyrics: "Y".repeat(5001),
      excludedStyles: "Z".repeat(1500),
    };
    const { warnings } = generateSunoPayload(input);

    const fields = warnings.map((w) => w.field);
    expect(fields).toContain("style");
    expect(fields).toContain("lyrics");
    expect(fields).toContain("negativeTags");
  });

  it("fragment-aware truncation: drops lowest-priority fields first", () => {
    const caps: SunoCapabilities = {
      maxLyricsLength: 10,
      maxStyleLength: 10,
      maxTitleLength: 10,
      maxNegativeTagsLength: 10,
      minDurationSec: 10,
      maxDurationSec: 360,
      supportsNegativeTags: true,
      supportsCallbacks: false,
      maxBatchSize: 2,
    };
    const { request, warnings } = generateSunoPayload(
      {
        ...MIN_INPUT,
        title: "Very Long Title That Exceeds Max",
        style: "X".repeat(100),
        lyrics: "Y".repeat(50),
        excludedStyles: "Z".repeat(30),
      },
      caps,
    );

    expect(warnings.length).toBeGreaterThanOrEqual(3);
    expect(request.style.length).toBeLessThanOrEqual(10);
    expect(request.title.length).toBeLessThanOrEqual(10);
    // No mid-fragment cut: each field is truncated cleanly at its limit
    expect(request.style.length).toBe(10);
    const titleWarn = warnings.find((w) => w.field === "title");
    expect(titleWarn?.priority).toBe(0);
  });

  it("fragment priority ordering is consistent", () => {
    const { warnings } = generateSunoPayload({
      ...MIN_INPUT,
      title: "A".repeat(200),
      style: "B".repeat(200),
      excludedStyles: "C".repeat(200),
      lyrics: "D".repeat(200),
    });
    const priorities = warnings.map((w) => w.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });
});

describe("payloadToLog", () => {
  it("returns a safe-for-logging subset", () => {
    const { request } = generateSunoPayload(MIN_INPUT);
    const log = payloadToLog(request);

    expect(log.title).toBe("My Track");
    expect(log.style).toBeDefined();
    expect(log.lyrics).toBeDefined();
    expect(log.instrumental).toBe(false);
    expect(log.model).toBe("V6");
    expect(log.duration).toBe(180);
  });
});

// ── Snapshot tests ─────────────────────────────────────────────────

describe("generateSunoPayload snapshots", () => {
  it("minimal input", () => {
    const result = generateSunoPayload(MIN_INPUT);
    expect(result).toMatchSnapshot();
  });

  it("with explicit model version", () => {
    const result = generateSunoPayload({
      ...MIN_INPUT,
      modelVersion: "V6_MINI",
    });
    expect(result).toMatchSnapshot();
  });

  it("with callback URL", () => {
    const result = generateSunoPayload({
      ...MIN_INPUT,
      callbackUrl: "https://example.com/callback",
    });
    expect(result).toMatchSnapshot();
  });

  it("instrumental mode (empty lyrics)", () => {
    const result = generateSunoPayload({
      ...MIN_INPUT,
      lyrics: "",
    });
    expect(result.request.lyrics).toBeUndefined();
    expect(result.request.instrumental).toBe(true);
    expect(result).toMatchSnapshot();
  });

  it("with per-take settings", () => {
    const result = generateSunoPayload({
      ...MIN_INPUT,
      modelVersion: "V6_WILD",
      vocalGender: "f",
      settings: { variety: 2, weirdness: 0.35, styleInfluence: 0.8 },
    });
    expect(result).toMatchSnapshot();
  });
});

// ── Suno v6 contract ───────────────────────────────────────────

describe("generateSunoPayload — v6 contract", () => {
  it("enforces the v6 character limits", () => {
    const caps = getCapabilities();
    expect(caps).toMatchObject({
      maxStyleLength: 1000,
      maxLyricsLength: 5000,
      maxNegativeTagsLength: 1000,
      maxTitleLength: 80,
      minDurationSec: 10,
      maxDurationSec: 360,
    });
  });

  it("truncates the title to 80 characters", () => {
    const { request, warnings } = generateSunoPayload({
      ...MIN_INPUT,
      title: "T".repeat(120),
    });
    expect(request.title.length).toBe(80);
    expect(warnings.map((w) => w.field)).toContain("title");
  });

  it("defaults variety to 0 so Suno leaves the style prompt untouched", () => {
    expect(generateSunoPayload(MIN_INPUT).request.variety).toBe(0);
  });

  it("clamps variety into 0–4", () => {
    const hi = generateSunoPayload({ ...MIN_INPUT, settings: { variety: 9 } });
    const lo = generateSunoPayload({ ...MIN_INPUT, settings: { variety: -3 } });
    expect(hi.request.variety).toBe(4);
    expect(lo.request.variety).toBe(0);
  });

  it("sends sliders only when set, rounded to two decimals in 0–1", () => {
    const unset = generateSunoPayload(MIN_INPUT).request;
    expect(unset.styleWeight).toBeUndefined();
    expect(unset.weirdnessConstraint).toBeUndefined();

    const set = generateSunoPayload({
      ...MIN_INPUT,
      settings: { weirdness: 0.3333, styleInfluence: 1.7 },
    }).request;
    expect(set.weirdnessConstraint).toBe(0.33);
    expect(set.styleWeight).toBe(1);
  });

  it("clamps a too-long arrangement to 360 seconds and says so", () => {
    const { request, warnings } = generateSunoPayload({
      ...MIN_INPUT,
      durationSec: 512,
    });
    expect(request.duration).toBe(360);
    const warn = warnings.find((w) => w.field === "duration");
    expect(warn?.message).toContain("at most 360s");
  });

  it("raises a too-short arrangement to 10 seconds", () => {
    const { request, warnings } = generateSunoPayload({
      ...MIN_INPUT,
      durationSec: 4,
    });
    expect(request.duration).toBe(10);
    expect(warnings.map((w) => w.field)).toContain("duration");
  });

  it("warns when no duration is known (Suno would render 20 seconds)", () => {
    const { durationSec: _omit, ...noDuration } = MIN_INPUT;
    const { request, warnings } = generateSunoPayload(noDuration);
    expect(request.duration).toBeUndefined();
    expect(warnings.find((w) => w.field === "duration")?.message).toContain(
      "20 seconds",
    );
  });

  it("omits vocalGender and lyrics on instrumental takes", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      lyrics: "",
      vocalGender: "f",
    });
    expect(request.instrumental).toBe(true);
    expect(request.vocalGender).toBeUndefined();
    expect(request.lyrics).toBeUndefined();
  });

  it("refuses a request with nothing for Suno to go on", () => {
    expect(() =>
      generateSunoPayload({
        title: "Empty",
        style: "",
        excludedStyles: "",
        lyrics: "",
      }),
    ).toThrow(/Nothing to send/);
  });

  it("reports every field that was truncated", () => {
    const result = generateSunoPayload({
      ...MIN_INPUT,
      style: "X".repeat(3000),
      lyrics: "Y".repeat(6000),
      excludedStyles: "Z".repeat(1500),
    });
    expect(result.request.style.length).toBe(1000);
    expect(result.request.lyrics!.length).toBe(5000);
    expect(result.request.negativeTags!.length).toBe(1000);
    expect(result.warnings.map((w) => w.field).sort()).toEqual([
      "lyrics",
      "negativeTags",
      "style",
    ]);
  });
});
