import { describe, it, expect, vi, beforeEach } from "vitest";
import { SunoClient, createSunoClientConfig } from "../src/suno/index.js";
import { normalizeTaskResponse } from "../src/suno/client.js";
import type { SunoClientConfig } from "../src/suno/index.js";
import type { Config } from "@track-forge/contracts";

const MIN_CONFIG: SunoClientConfig = {
  baseUrl: "https://api.sunomusic.com/v1",
  authToken: "test-token-123",
  defaultModelVersion: "V4_5ALL",
  pollIntervalMs: 5000,
  pollTimeoutMs: 300000,
};

const MIN_APP_CONFIG: Pick<Config, "publicBaseUrl"> = {
  publicBaseUrl: undefined,
};

function makeClient() {
  return new SunoClient(MIN_CONFIG, MIN_APP_CONFIG, {
    child: () => ({ info: () => {} }),
  } as any);
}

describe("SunoClient.submit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST /api/v1/generate with expected body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        msg: "success",
        data: { taskId: "task-001" },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const result = await client.submit({
      customMode: true,
      instrumental: false,
      model: "V4_5ALL",
      title: "Test Track",
      style: "Deep house, warm pads",
      prompt: "[Verse]\nHello world",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.sunomusic.com/v1/api/v1/generate");
    expect(opts.method).toBe("POST");
    expect(opts.headers).toMatchObject({
      Authorization: "Bearer test-token-123",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(opts.body);
    expect(body).toMatchSnapshot();
    expect(result.taskId).toBe("task-001");
    expect(result.callbackConfigured).toBe(false);
  });

  it("includes optional fields when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        msg: "success",
        data: { taskId: "task-002" },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    await client.submit({
      customMode: true,
      instrumental: false,
      model: "V4_5ALL",
      title: "Track",
      style: "Style",
      prompt: "Lyrics",
      negativeTags: "slow, ballad",
      callBackUrl: "https://hook.example.com/callback",
      vocalGender: "f",
      styleWeight: 0.5,
      weirdnessConstraint: 0.3,
      audioWeight: 0.7,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchSnapshot();
  });

  it("includes persona fields when personaId provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        msg: "success",
        data: { taskId: "task-003" },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    await client.submit({
      customMode: true,
      instrumental: false,
      model: "V4_5ALL",
      title: "Persona Track",
      style: "Style",
      prompt: "Lyrics",
      personaId: "pers-001",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchSnapshot();
  });

  it("includes callBackUrl when publicBaseUrl is configured", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        msg: "success",
        data: { taskId: "task-004" },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new SunoClient(
      MIN_CONFIG,
      { publicBaseUrl: "https://myapp.example.com" },
      { child: () => ({ info: () => {} }) } as any,
    );
    await client.submit({
      customMode: true,
      instrumental: false,
      model: "V4_5ALL",
      title: "Callback Track",
      style: "Style",
      prompt: "Lyrics",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.callBackUrl).toBe(
      "https://myapp.example.com/api/suno/callback",
    );
    expect(body).toMatchSnapshot();
  });

  it("throws on non-200 API response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 400, msg: "Bad request" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    await expect(
      client.submit({
        customMode: true,
        instrumental: false,
        model: "V4_5ALL",
        title: "Fail",
        style: "Style",
      }),
    ).rejects.toThrow("Suno API error");
  });
});

describe("normalizeTaskResponse", () => {
  it("SUCCESS status with one song", () => {
    const result = normalizeTaskResponse("task-001", {
      taskId: "task-001",
      status: "SUCCESS",
      response: {
        sunoData: [
          {
            id: "song-001",
            title: "My Song",
            audioUrl: "https://cdn.example.com/audio.mp3",
            imageUrl: "https://cdn.example.com/image.png",
            videoUrl: "https://cdn.example.com/video.mp4",
            duration: 180,
            tags: "deep house, warm",
            prompt: "[Verse]\nHello",
            modelName: "V4_5",
            createTime: "2025-01-01T00:00:00Z",
          },
        ],
      },
    });
    expect(result).toMatchSnapshot();
  });

  it("PENDING status", () => {
    const result = normalizeTaskResponse("task-002", {
      taskId: "task-002",
      status: "PENDING",
    });
    expect(result).toMatchSnapshot();
  });

  it("ERROR status with error message", () => {
    const result = normalizeTaskResponse("task-003", {
      taskId: "task-003",
      status: "CREATE_TASK_FAILED",
      errorCode: "ERR_001",
      errorMessage: "Failed to create task",
    });
    expect(result).toMatchSnapshot();
  });

  it("empty sunoData array", () => {
    const result = normalizeTaskResponse("task-004", {
      taskId: "task-004",
      status: "SUCCESS",
      response: {
        sunoData: [],
      },
    });
    expect(result).toMatchSnapshot();
  });

  it("TEXT_SUCCESS status maps to processing", () => {
    const result = normalizeTaskResponse("task-005", {
      taskId: "task-005",
      status: "TEXT_SUCCESS",
      response: { sunoData: [{ id: "song-005" }] },
    });
    expect(result).toMatchSnapshot();
  });
});
