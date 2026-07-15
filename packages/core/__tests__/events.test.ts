import { describe, it, expect, beforeEach } from "vitest";
import {
  subscribe,
  publish,
  unsubscribeAll,
  resetTestCounters,
} from "../src/pipeline/events.js";

describe("EventBus", () => {
  const jobId = "test-job-1";

  beforeEach(() => {
    unsubscribeAll(jobId);
    resetTestCounters();
  });

  it("subscribes and receives events", () => {
    const events: any[] = [];
    subscribe(jobId, (e) => events.push(e));

    publish(undefined, jobId, { stage: "planning", status: "started" });
    expect(events).toHaveLength(1);
    expect(events[0].stage).toBe("planning");
    expect(events[0].status).toBe("started");
    expect(events[0].jobId).toBe(jobId);
    expect(events[0].timestamp).toBeDefined();
  });

  it("publish assigns sequence number", async () => {
    const events: any[] = [];
    subscribe(jobId, (e) => events.push(e));

    await publish(undefined, jobId, { stage: "planning", status: "started" });
    await publish(undefined, jobId, { stage: "planning", status: "completed" });
    expect(events[0].sequence).toBe(1);
    expect(events[1].sequence).toBe(2);
  });

  it("returns unsubscribe function", async () => {
    const events: any[] = [];
    const unsub = subscribe(jobId, (e) => events.push(e));
    unsub();

    await publish(undefined, jobId, { stage: "planning", status: "started" });
    expect(events).toHaveLength(0);
  });

  it("multiple subscribers all receive events", async () => {
    const ev1: any[] = [];
    const ev2: any[] = [];
    subscribe(jobId, (e) => ev1.push(e));
    subscribe(jobId, (e) => ev2.push(e));

    await publish(undefined, jobId, {
      stage: "compilation",
      status: "completed",
    });
    expect(ev1).toHaveLength(1);
    expect(ev2).toHaveLength(1);
  });

  it("unsubscribeAll removes all subscribers for a job", async () => {
    const events: any[] = [];
    subscribe(jobId, (e) => events.push(e));
    unsubscribeAll(jobId);

    await publish(undefined, jobId, { stage: "versioning", status: "started" });
    expect(events).toHaveLength(0);
  });

  it("publish does not affect other jobs", async () => {
    const ev1: any[] = [];
    subscribe(jobId, (e) => ev1.push(e));
    subscribe("other-job", (e) => ev1.push(e));

    await publish(undefined, jobId, { stage: "planning", status: "completed" });
    expect(ev1).toHaveLength(1);
  });
});
