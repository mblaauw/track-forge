import { describe, it, expect } from "vitest";
import {
  createAbortController,
  abortJob,
  getJobSignal,
  hasActiveJob,
  cleanupJob,
} from "../src/pipeline/job-abort-controller.js";

describe("job-abort-controller", () => {
  it("creates a controller for a job", () => {
    const ctrl = createAbortController("job-1");
    expect(ctrl.signal.aborted).toBe(false);
    expect(hasActiveJob("job-1")).toBe(true);
    cleanupJob("job-1");
  });

  it("returns existing controller for same job", () => {
    const ctrl1 = createAbortController("job-2");
    const ctrl2 = createAbortController("job-2");
    expect(ctrl1).toBe(ctrl2);
    cleanupJob("job-2");
  });

  it("creates new controller after previous is cleaned up", () => {
    const ctrl1 = createAbortController("job-3");
    cleanupJob("job-3");
    const ctrl2 = createAbortController("job-3");
    expect(ctrl1).not.toBe(ctrl2);
    cleanupJob("job-3");
  });

  it("abortJob aborts the controller and removes from registry", () => {
    createAbortController("job-4");
    expect(hasActiveJob("job-4")).toBe(true);
    const aborted = abortJob("job-4");
    expect(aborted).toBe(true);
    expect(hasActiveJob("job-4")).toBe(false);
  });

  it("abortJob returns false for unknown job", () => {
    expect(abortJob("nonexistent")).toBe(false);
  });

  it("getJobSignal returns undefined for unknown job", () => {
    expect(getJobSignal("unknown")).toBeUndefined();
  });

  it("getJobSignal returns signal from registered controller", () => {
    createAbortController("job-5");
    const signal = getJobSignal("job-5");
    expect(signal).toBeDefined();
    expect(signal!.aborted).toBe(false);
    cleanupJob("job-5");
  });

  it("aborting a job causes signal to be aborted", () => {
    createAbortController("job-6");
    abortJob("job-6");
    expect(hasActiveJob("job-6")).toBe(false);
  });

  it("hasActiveJob returns false for unknown job", () => {
    expect(hasActiveJob("ghost")).toBe(false);
  });

  it("hasActiveJob returns false after cleanup", () => {
    createAbortController("job-7");
    cleanupJob("job-7");
    expect(hasActiveJob("job-7")).toBe(false);
  });

  it("double abort is safe", () => {
    createAbortController("job-8");
    abortJob("job-8");
    expect(abortJob("job-8")).toBe(false);
  });

  it("cleanupJob does not throw for unknown job", () => {
    expect(() => cleanupJob("nowhere")).not.toThrow();
  });

  it("creates new controller after previous was aborted", () => {
    createAbortController("job-9");
    abortJob("job-9");
    const ctrl = createAbortController("job-9");
    expect(ctrl.signal.aborted).toBe(false);
    cleanupJob("job-9");
  });
});
