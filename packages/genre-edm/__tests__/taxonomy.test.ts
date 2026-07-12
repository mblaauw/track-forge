import { describe, it, expect } from "vitest";
import {
  EdmFamily,
  EDM_SUBGENRES,
  getSubgenre,
  getSubgenresByFamily,
  getFamilyLabel,
  getAllFamilyOptions,
  getSubgenreOptions,
} from "../src/taxonomy.js";

describe("EDM taxonomy", () => {
  it("has 10 families", () => {
    expect(EdmFamily).toHaveLength(10);
    expect(EdmFamily).toContain("house");
    expect(EdmFamily).toContain("techno");
    expect(EdmFamily).toContain("pop");
  });

  it("has 43 subgenres total", () => {
    expect(EDM_SUBGENRES).toHaveLength(43);
  });

  it("each subgenre has required fields", () => {
    for (const s of EDM_SUBGENRES) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(EdmFamily).toContain(s.family);
      expect(s.bpmRange).toHaveLength(2);
      expect(s.bpmRange[0]).toBeLessThanOrEqual(s.bpmRange[1]);
      expect(s.bpmDefault).toBeGreaterThanOrEqual(s.bpmRange[0]);
      expect(s.bpmDefault).toBeLessThanOrEqual(s.bpmRange[1]);
      expect(["major", "minor"]).toContain(s.scale);
      expect(s.characteristics.length).toBeGreaterThan(0);
      expect(s.description).toBeTruthy();
    }
  });

  it("getSubgenre returns entry by id", () => {
    const entry = getSubgenre("deep_house");
    expect(entry).toBeDefined();
    expect(entry!.label).toBe("Deep House");
    expect(entry!.family).toBe("house");
  });

  it("getSubgenre returns undefined for unknown id", () => {
    expect(getSubgenre("nonexistent")).toBeUndefined();
  });

  it("getSubgenresByFamily returns correct count per family", () => {
    const house = getSubgenresByFamily("house");
    expect(house.length).toBeGreaterThanOrEqual(6);

    const techno = getSubgenresByFamily("techno");
    expect(techno.length).toBeGreaterThanOrEqual(6);

    const dnb = getSubgenresByFamily("dnb");
    expect(dnb.length).toBeGreaterThanOrEqual(4);
  });

  it("getFamilyLabel returns labels", () => {
    expect(getFamilyLabel("house")).toBe("House");
    expect(getFamilyLabel("dnb")).toBe("Drum & Bass");
    expect(getFamilyLabel("downtempo")).toBe("Downtempo / Chill");
  });

  it("getAllFamilyOptions returns all families", () => {
    const opts = getAllFamilyOptions();
    expect(opts).toHaveLength(10);
    expect(opts[0]).toEqual({ label: "House", value: "house" });
  });

  it("getSubgenreOptions returns options for a family", () => {
    const opts = getSubgenreOptions("house");
    expect(opts.length).toBeGreaterThan(0);
    expect(opts[0].label).toBeTruthy();
    expect(opts[0].value).toBeTruthy();
  });
});
