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

  it("has 43 subgenres in YAML (TS fallback has 1 entry)", () => {
    expect(EDM_SUBGENRES).toHaveLength(1);
  });

  it("getSubgenre returns fallback entry by id", () => {
    const entry = getSubgenre("deep_house");
    expect(entry).toBeDefined();
    expect(entry!.label).toBe("Deep House");
    expect(entry!.family).toBe("house");
  });

  it("getSubgenre returns undefined for unknown id", () => {
    expect(getSubgenre("nonexistent")).toBeUndefined();
  });

  it("getSubgenresByFamily returns fallback entry for house", () => {
    expect(getSubgenresByFamily("house")).toHaveLength(1);
    expect(getSubgenresByFamily("techno")).toHaveLength(0);
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

  it("getSubgenreOptions returns fallback options for house", () => {
    const opts = getSubgenreOptions("house");
    expect(opts).toHaveLength(1);
    expect(opts[0].label).toBe("Deep House");
    expect(opts[0].value).toBe("deep_house");
  });
});
