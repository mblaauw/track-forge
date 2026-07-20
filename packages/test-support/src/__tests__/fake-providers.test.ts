import { describe, it, expect } from "vitest";
import { createFakeLlmServer } from "../providers/fake-llm-server.js";
import { createFakeSunoServer } from "../providers/fake-suno-server.js";
import {
  instrumentalSuccess,
  vocalSuccess,
  llmTimeout,
  llmMalformed,
  sunoSubmitFails,
  sunoPendingThenComplete,
  sunoPendingThenFailed,
  sunoCallbackBeforePoll,
  listScenarios,
} from "../providers/scenarios.js";
import { mockLlm, mockSuno } from "../index.js";

describe("Fake LLM server", () => {
  it("returns success content on success scenario", async () => {
    const llm = createFakeLlmServer({ scenario: "success" });
    const res = await llm.complete();
    expect(res.content).toContain("Test verse lyrics");
    expect(res.model).toBe("fake-llm");
  });

  it("throws on timeout scenario", async () => {
    const llm = createFakeLlmServer({ scenario: "timeout" });
    await expect(llm.complete()).rejects.toThrow("LLM timeout");
  });

  it("returns empty content on empty scenario", async () => {
    const llm = createFakeLlmServer({ scenario: "empty" });
    const res = await llm.complete();
    expect(res.content).toBe("");
  });

  it("returns malformed (non-JSON) content on malformed scenario", async () => {
    const llm = createFakeLlmServer({ scenario: "malformed" });
    const res = await llm.complete();
    expect(res.content).not.toContain("{");
    expect(res.content).toContain("not valid lyrics");
  });

  it("tracks call count", async () => {
    const llm = createFakeLlmServer({ scenario: "success" });
    expect(llm.getCallCount()).toBe(0);
    await llm.complete();
    await llm.complete();
    expect(llm.getCallCount()).toBe(2);
  });

  it("supports reset and scenario change", async () => {
    const llm = createFakeLlmServer({ scenario: "success" });
    await llm.complete();
    llm.reset();
    expect(llm.getCallCount()).toBe(0);
    llm.setScenario("timeout");
    await expect(llm.complete()).rejects.toThrow("LLM timeout");
  });
});

describe("Fake Suno server", () => {
  it("returns taskId on success scenario", async () => {
    const suno = createFakeSunoServer({ scenario: "success" });
    const result = await suno.submit();
    expect(result.taskId).toBeTruthy();
    expect(result.callbackConfigured).toBe(false);
  });

  it("throws on submit_fails scenario", async () => {
    const suno = createFakeSunoServer({ scenario: "submit_fails" });
    await expect(suno.submit()).rejects.toThrow("Mock Suno error");
  });

  it("returns empty ids on invalid_response scenario", async () => {
    const suno = createFakeSunoServer({ scenario: "invalid_response" });
    const result = await suno.submit();
    expect(result.taskId).toBeFalsy();
  });

  it("completes when polling pending_then_complete", async () => {
    const suno = createFakeSunoServer({
      scenario: "pending_then_complete",
      pollDelayMs: 0,
    });
    const result = await suno.submit();
    const status = await suno.waitForCompletion(result.taskId);
    expect(status.status).toBe("completed");
    expect(status.audioUrl).toBeTruthy();
  });

  it("fails when polling pending_then_failed", async () => {
    const suno = createFakeSunoServer({
      scenario: "pending_then_failed",
      pollDelayMs: 0,
    });
    const result = await suno.submit();
    const status = await suno.waitForCompletion(result.taskId);
    expect(status.status).toBe("failed");
    expect(status.error).toBeTruthy();
  });

  it("tracks callbacks on callback_before_poll", async () => {
    const suno = createFakeSunoServer({ scenario: "callback_before_poll" });
    await suno.submit();
    expect(suno.getCallbacks()).toHaveLength(1);
  });

  it("tracks submit and poll counts", async () => {
    const suno = createFakeSunoServer({ scenario: "success" });
    expect(suno.getSubmitCount()).toBe(0);
    await suno.submit();
    expect(suno.getSubmitCount()).toBe(1);
  });
});

describe("Pre-built scenarios", () => {
  it("all scenarios return expected fields", () => {
    const scenarios = [
      instrumentalSuccess,
      vocalSuccess,
      llmTimeout,
      llmMalformed,
      sunoSubmitFails,
      sunoPendingThenComplete,
      sunoPendingThenFailed,
      sunoCallbackBeforePoll,
    ];
    for (const factory of scenarios) {
      const s = factory();
      expect(s.name).toBeTruthy();
      expect(s.llm).toBeDefined();
      expect(s.suno).toBeDefined();
    }
  });

  it("lists all registered scenarios", () => {
    const names = listScenarios();
    expect(names).toContain("instrumental-success");
    expect(names).toContain("vocal-success");
    expect(names).toContain("llm-timeout");
    expect(names).toContain("suno-pending-then-failed");
    expect(names.length).toBeGreaterThanOrEqual(8);
  });
});

describe("mockLlm and mockSuno (legacy)", () => {
  it("mockLlm returns response content", async () => {
    const llm = mockLlm();
    const res = await llm.complete();
    expect(res.content).toBeTruthy();
    expect(res.model).toBe("mock");
  });

  it("mockLlm accepts custom response", async () => {
    const llm = mockLlm("custom response");
    const res = await llm.complete();
    expect(res.content).toBe("custom response");
  });

  it("mockSuno returns with taskId", async () => {
    const suno = mockSuno();
    const result = await suno.submit();
    expect(result.taskId).toBe("mock-id");
    expect(result.callbackConfigured).toBe(false);
  });
});
