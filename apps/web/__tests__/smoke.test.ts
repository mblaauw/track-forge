import { describe, it, expect } from "vitest";

describe("Web app smoke test", () => {
  it("module system works", () => {
    // Basic smoke test — verifies vitest can run in web workspace
    expect(1 + 1).toBe(2);
  });
});
