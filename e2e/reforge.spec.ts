import { test, expect, type Page } from "@playwright/test";
import { ForgePage } from "./pages/ForgePage";

/**
 * Forging the same session twice.
 *
 * The second forge has to render what is on screen now: a new version built
 * from the edited inputs, and exactly one take on that version. It used to
 * fail on the server while the page replayed the first run's events and
 * rendered another take of the old version.
 */

const createdJobIds: string[] = [];

test.afterEach(async ({ request }) => {
  for (const id of createdJobIds) {
    await request.delete(`/api/jobs/${id}`).catch(() => {});
  }
  createdJobIds.length = 0;
});

/** POST /takes calls made by the page, as the version id each one targeted. */
function trackTakeRequests(page: Page): string[] {
  const versionIds: string[] = [];
  page.on("request", (req) => {
    const match = /\/api\/versions\/([^/]+)\/takes$/.exec(
      new URL(req.url()).pathname,
    );
    if (req.method() === "POST" && match) versionIds.push(match[1]!);
  });
  return versionIds;
}

async function sessionJobId(page: Page): Promise<string> {
  const handle = await page.waitForFunction(() => {
    const raw = localStorage.getItem("tf-session");
    return raw ? (JSON.parse(raw).jobId as string | null) : null;
  });
  const id = (await handle.jsonValue()) as string;
  createdJobIds.push(id);
  return id;
}

function styleOf(version: { artifacts: string | { type: string }[] }): string {
  const list = (
    typeof version.artifacts === "string"
      ? JSON.parse(version.artifacts)
      : version.artifacts
  ) as { type: string; value: string }[];
  return list.find((a) => a.type === "style")?.value ?? "";
}

test.describe("re-forging a session", () => {
  test("second forge renders the edited session as a new version", async ({
    page,
    request,
  }) => {
    const forge = new ForgePage(page);
    const takeRequests = trackTakeRequests(page);
    await forge.goto();

    // ── First forge ─────────────────────────────────────────────────
    await forge.forgeInstrumental();
    await expect(forge.contextBar.statusText).toHaveText("Ready");
    const jobId = await sessionJobId(page);
    expect(takeRequests).toHaveLength(1);

    // ── Edit, then forge again ──────────────────────────────────────
    const bpm = page.getByTestId("bpm-input");
    await bpm.fill("101");
    await bpm.blur();

    await forge.contextBar.clickForge();
    await forge.contextBar.waitForForgeComplete(20_000);
    await expect(forge.contextBar.statusText).toHaveText("Ready");

    // ── The server has two versions; the new one carries the edit ────
    const versions = await (
      await request.get(`/api/jobs/${jobId}/versions`)
    ).json();
    expect(versions).toHaveLength(2);
    const [latest, first] = versions;
    expect(latest.number).toBe(2);
    expect(styleOf(latest)).toContain("around 101 BPM");
    expect(styleOf(first)).not.toContain("around 101 BPM");

    // ── One take per forge, the second on the new version ───────────
    expect(takeRequests).toHaveLength(2);
    expect(takeRequests[1]).toBe(latest.id);
    const takes = await (
      await request.get(`/api/versions/${latest.id}/takes`)
    ).json();
    expect(takes).toHaveLength(1);
    const oldTakes = await (
      await request.get(`/api/versions/${first.id}/takes`)
    ).json();
    expect(oldTakes).toHaveLength(1);
  });

  test("a start that fails renders no take and says why", async ({ page }) => {
    const forge = new ForgePage(page);
    const takeRequests = trackTakeRequests(page);
    await forge.goto();

    await forge.forgeInstrumental();
    await sessionJobId(page);
    expect(takeRequests).toHaveLength(1);

    // The next start is refused by the server.
    await page.route("**/api/jobs/*/start", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "Job is already running" }),
      }),
    );

    await forge.contextBar.clickForge();

    await expect(forge.contextBar.statusText).toHaveText("Failed");
    await expect(page.getByTestId("forge-error")).toHaveText(
      "Job is already running",
    );
    await expect(forge.contextBar.forgeBtn).not.toBeDisabled();

    // No replayed event may have triggered a take of the old version.
    await page.waitForTimeout(1500);
    expect(takeRequests).toHaveLength(1);
  });
});
