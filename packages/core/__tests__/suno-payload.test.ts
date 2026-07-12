import { describe, it, expect } from "vitest";
import { generateSunoPayload, payloadToLog } from "../src/suno/payload.js";
import type { SunoPayloadInput } from "../src/suno/payload.js";
import { getCapabilities } from "../src/suno/capabilities.js";

// ── Helpers ──────────────────────────────────────────────────────────

const MIN_INPUT: SunoPayloadInput = {
  title: "My Track",
  style: "Deep house with warm pads and groovy bassline",
  excludedStyles: "slow, ballad",
  lyrics: "[Intro]\n(atmospheric pads)\n\n[Drop]\n(groovy beat)",
};

// ── Tests ────────────────────────────────────────────────────────────

describe("generateSunoPayload", () => {
  it("produces a valid SunoGenerateRequest from minimal input", () => {
    const { request, warnings } = generateSunoPayload(MIN_INPUT);

    expect(request.title).toBe("My Track");
    expect(request.style).toContain("Deep house");
    expect(request.lyrics).toContain("[Intro]");
    expect(request.negativeTags).toBe("slow, ballad");
    expect(request.instrumental).toBe(false);
    expect(warnings).toHaveLength(0);
  });

  it("sets instrumental=true when lyrics are empty", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      lyrics: "",
    });

    expect(request.instrumental).toBe(true);
    expect(request.lyrics).toBe("");
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

  it("omits negativeTags when model does not support them", () => {
    const caps = getCapabilities("chirp-v2");
    const { request } = generateSunoPayload(MIN_INPUT, caps);

    expect(request.negativeTags).toBeUndefined();
  });

  it("truncates style when exceeding max length", () => {
    const input: SunoPayloadInput = {
      ...MIN_INPUT,
      style: "X".repeat(3000),
    };
    const { request, warnings } = generateSunoPayload(input);

    expect(request.style.length).toBe(2000);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe("style");
  });

  it("truncates lyrics when exceeding max length", () => {
    const input: SunoPayloadInput = {
      ...MIN_INPUT,
      lyrics: "X".repeat(5000),
    };
    const { request, warnings } = generateSunoPayload(input);

    expect(request.lyrics.length).toBe(3000);
    expect(warnings.some((w) => w.field === "lyrics")).toBe(true);
  });

  it("truncates negativeTags when exceeding max length", () => {
    const input: SunoPayloadInput = {
      ...MIN_INPUT,
      excludedStyles: "X".repeat(1000),
    };
    const caps = getCapabilities("chirp-v3-5");
    const { request, warnings } = generateSunoPayload(input, caps);

    expect(request.negativeTags?.length).toBe(500);
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
      modelVersion: "chirp-v2",
    });

    expect(request.modelVersion).toBe("chirp-v2");
  });

  it("passes through callbackUrl when capabilities support it", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      callbackUrl: "https://example.com/callback",
      webhookToken: "secret-123",
    });

    expect(request.callbackUrl).toBe("https://example.com/callback");
    expect(request.webhookToken).toBe("secret-123");
  });

  it("strips callbackUrl when capabilities do not support it", () => {
    const { request } = generateSunoPayload(
      {
        ...MIN_INPUT,
        callbackUrl: "https://example.com/callback",
        webhookToken: "secret-123",
        modelVersion: "chirp-v2",
      },
      getCapabilities("chirp-v2"),
    );

    expect(request.callbackUrl).toBeUndefined();
    expect(request.webhookToken).toBeUndefined();
  });

  it("applies BPM from genre transform when style lacks BPM", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      genreTransform: { genreId: "edm", bpm: 128, subgenre: "deep_house" },
    });

    expect(request.style).toMatch(/128\s*BPM/);
  });

  it("does not duplicate BPM when style already has it", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      style: "Deep house 120 BPM warm pads",
      genreTransform: { genreId: "edm", bpm: 128, subgenre: "deep_house" },
    });

    // Should not add a second BPM
    const bpmMatches = request.style.match(/\b\d{2,3}\s*BPM\b/g);
    expect(bpmMatches).toHaveLength(1);
    expect(bpmMatches![0]).toBe("120 BPM");
  });

  it("applies mood from genre transform when not in style", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      genreTransform: { genreId: "edm", mood: "dark and hypnotic", energy: 7 },
    });

    expect(request.style).toMatch(/Mood: dark and hypnotic/);
  });

  it("applies high energy descriptor for energy >= 8", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      genreTransform: { genreId: "edm", energy: 9 },
    });

    expect(request.style).toMatch(/High energy/i);
  });

  it("applies low energy descriptor for energy <= 4", () => {
    const { request } = generateSunoPayload({
      ...MIN_INPUT,
      genreTransform: { genreId: "edm", energy: 3 },
    });

    expect(request.style).toMatch(/Low energy/i);
  });

  it("returns empty warnings for well-formed input", () => {
    const { warnings } = generateSunoPayload(MIN_INPUT);

    expect(warnings).toHaveLength(0);
  });

  it("returns warnings for multiple truncations", () => {
    const input: SunoPayloadInput = {
      ...MIN_INPUT,
      style: "X".repeat(3000),
      lyrics: "Y".repeat(5000),
      excludedStyles: "Z".repeat(1000),
    };
    const { warnings } = generateSunoPayload(input);

    const fields = warnings.map((w) => w.field);
    expect(fields).toContain("style");
    expect(fields).toContain("lyrics");
    expect(fields).toContain("negativeTags");
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
    expect(log.modelVersion).toBeUndefined();
  });
});
