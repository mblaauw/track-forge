import { describe, it, expect, beforeEach } from "vitest";
import { subscribe, publish, unsubscribeAll } from "../src/pipeline/events.js";

describe("EventBus", () => {
  const jobId = "test-job-1";

  beforeEach(() => {
    unsubscribeAll(jobId);
  });

  it("subscribes and receives events", () => {
    const events: any[] = [];
    subscribe(jobId, (e) => events.push(e));

    publish(jobId, { stage: "planning", status: "started" });
    expect(events).toHaveLength(1);
    expect(events[0].stage).toBe("planning");
    expect(events[0].status).toBe("started");
    expect(events[0].jobId).toBe(jobId);
    expect(events[0].timestamp).toBeDefined();
  });

  it("returns unsubscribe function", () => {
    const events: any[] = [];
    const unsub = subscribe(jobId, (e) => events.push(e));
    unsub();

    publish(jobId, { stage: "planning", status: "started" });
    expect(events).toHaveLength(0);
  });

  it("multiple subscribers all receive events", () => {
    const ev1: any[] = [];
    const ev2: any[] = [];
    subscribe(jobId, (e) => ev1.push(e));
    subscribe(jobId, (e) => ev2.push(e));

    publish(jobId, { stage: "compilation", status: "completed" });
    expect(ev1).toHaveLength(1);
    expect(ev2).toHaveLength(1);
  });

  it("unsubscribeAll removes all subscribers for a job", () => {
    const events: any[] = [];
    subscribe(jobId, (e) => events.push(e));
    unsubscribeAll(jobId);

    publish(jobId, { stage: "versioning", status: "started" });
    expect(events).toHaveLength(0);
  });

  it("publish does not affect other jobs", () => {
    const ev1: any[] = [];
    subscribe(jobId, (e) => ev1.push(e));
    subscribe("other-job", (e) => ev1.push(e));

    publish(jobId, { stage: "planning", status: "completed" });
    expect(ev1).toHaveLength(1);
  });
});
