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

  it("has 43 subgenres (from YAML)", () => {
    expect(EDM_SUBGENRES).toHaveLength(43);
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

  it("getSubgenresByFamily returns entries filtered by family", () => {
    expect(getSubgenresByFamily("house")).toHaveLength(6);
    expect(getSubgenresByFamily("techno")).toHaveLength(6);
    expect(getSubgenresByFamily("pop")).toHaveLength(4);
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
    expect(opts).toHaveLength(6);
    expect(opts[0].label).toBe("Deep House");
    expect(opts[0].value).toBe("deep_house");
  });
});
