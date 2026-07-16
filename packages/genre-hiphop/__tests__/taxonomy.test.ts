import { describe, it, expect } from "vitest";
import {
  HIP_HOP_SUBGENRES,
  getSubgenre,
  getSubgenreOptions,
} from "../src/taxonomy.js";

describe("Hip-Hop taxonomy", () => {
  it("has 22 subgenres", () => {
    expect(HIP_HOP_SUBGENRES).toHaveLength(22);
  });

  it("each subgenre has required fields", () => {
    for (const s of HIP_HOP_SUBGENRES) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.bpmRange).toHaveLength(2);
      expect(s.bpmRange[0]).toBeLessThanOrEqual(s.bpmRange[1]);
      expect(s.bpmDefault).toBeGreaterThanOrEqual(s.bpmRange[0]);
      expect(s.bpmDefault).toBeLessThanOrEqual(s.bpmRange[1]);
      expect(s.characteristics.length).toBeGreaterThan(0);
      expect(s.defaultNarrative).toBeTruthy();
      expect(s.defaultFlow).toBeTruthy();
      expect(s.defaultDelivery).toBeTruthy();
      expect(s.defaultProduction).toBeTruthy();
    }
  });

  it("getSubgenre returns entry by id", () => {
    const entry = getSubgenre("boom_bap");
    expect(entry).toBeDefined();
    expect(entry!.label).toBe("Boom Bap");
  });

  it("getSubgenre returns undefined for unknown id", () => {
    expect(getSubgenre("nonexistent")).toBeUndefined();
  });

  it("getSubgenreOptions returns options for all subgenres", () => {
    const opts = getSubgenreOptions();
    expect(opts).toHaveLength(22);
    expect(opts[0].label).toBeTruthy();
    expect(opts[0].value).toBeTruthy();
  });

  it("includes key subgenres", () => {
    const ids = HIP_HOP_SUBGENRES.map((s) => s.id);
    expect(ids).toContain("boom_bap");
    expect(ids).toContain("trap");
    expect(ids).toContain("drill");
    expect(ids).toContain("old_school");
    expect(ids).toContain("gangsta_rap");
  });
});
