import { initConfig } from "./lib/config.js";
import { initDb } from "./lib/db.js";
import { schema } from "@track-forge/core";
import { eq } from "drizzle-orm";
import { writeFileSync, readFileSync } from "node:fs";
import type { ExportBundle, ImportResult } from "@track-forge/contracts";
import { getModule } from "./lib/modules.js";

async function run() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.error("Usage:");
    console.error("  track-forge export <jobId> [output.json]");
    console.error("  track-forge export-all [output.json]");
    console.error("  track-forge import <file.json>");
    process.exit(1);
  }

  const config = initConfig();
  const db = initDb(config);

  if (command === "export") {
    const jobId = args[1];
    const outputPath = args[2] ?? `${jobId}.json`;

    if (!jobId) {
      console.error("Usage: track-forge export <jobId> [output.json]");
      process.exit(1);
    }

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, jobId))
      .limit(1);

    if (!job) {
      console.error(`Job not found: ${jobId}`);
      process.exit(1);
    }

    const versions = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.jobId, jobId))
      .orderBy(schema.versions.number);

    const bundle: ExportBundle = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      projects: [
        {
          project: {
            id: "" as any,
            name: job.name ?? "Exported Job",
            description: null,
            genreId: null,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
          },
          jobs: [{ job: job as any, versions: versions as any[] }],
        },
      ],
    };

    writeFileSync(outputPath, JSON.stringify(bundle, null, 2));
    console.log(`Exported job ${jobId} to ${outputPath}`);
  } else if (command === "export-all") {
    const outputPath = args[1] ?? "track-forge-export.json";

    const jobs = await db.select().from(schema.jobs);
    const entries = [];

    for (const job of jobs) {
      const versions = await db
        .select()
        .from(schema.versions)
        .where(eq(schema.versions.jobId, job.id))
        .orderBy(schema.versions.number);

      entries.push({ job: job as any, versions: versions as any[] });
    }

    const bundle: ExportBundle = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      projects: [
        {
          project: {
            id: "" as any,
            name: "Bulk Export",
            description: null,
            genreId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          jobs: entries,
        },
      ],
    };

    writeFileSync(outputPath, JSON.stringify(bundle, null, 2));
    console.log(`Exported ${entries.length} jobs to ${outputPath}`);
  } else if (command === "import") {
    const inputPath = args[1];

    if (!inputPath) {
      console.error("Usage: track-forge import <file.json>");
      process.exit(1);
    }

    const raw = readFileSync(inputPath, "utf-8");
    const bundle = JSON.parse(raw) as ExportBundle;

    if (bundle.formatVersion !== 1) {
      console.error("Invalid formatVersion. Expected 1.");
      process.exit(1);
    }

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    const allJobEntries = (bundle.projects ?? []).flatMap((p) => p.jobs);

    for (let i = 0; i < allJobEntries.length; i++) {
      const entry = allJobEntries[i]!;

      try {
        if (!entry.job || !entry.job.genreId || !entry.job.presetId) {
          throw new Error("Missing required job fields (genreId, presetId)");
        }

        const mod = getModule(entry.job.genreId);
        if (!mod) {
          throw new Error(`Unknown genre: ${entry.job.genreId}`);
        }

        if (entry.job.inputs) {
          const parsed = JSON.parse(entry.job.inputs);
          const validated = mod.inputSchema.safeParse(parsed);
          if (!validated.success) {
            throw new Error(
              `Invalid inputs for genre ${entry.job.genreId}: ${validated.error.message}`,
            );
          }
        }

        const [existing] = await db
          .select()
          .from(schema.jobs)
          .where(eq(schema.jobs.id, entry.job.id))
          .limit(1);

        if (existing) {
          result.skipped++;
          continue;
        }

        const now = new Date().toISOString();

        await db.insert(schema.jobs).values({
          id: entry.job.id,
          name: entry.job.name ?? null,
          genreId: entry.job.genreId,
          presetId: entry.job.presetId,
          status: entry.job.status ?? "pending",
          currentStage: entry.job.currentStage ?? "ref_interpretation",
          reference: entry.job.reference ?? null,
          sourceHash: entry.job.sourceHash ?? null,
          inputs: entry.job.inputs ?? null,
          nlAdjustments: entry.job.nlAdjustments ?? null,
          findings: entry.job.findings ?? null,
          compiledJson: entry.job.compiledJson ?? null,
          stageAttempt: entry.job.stageAttempt ?? 0,
          error: entry.job.error ?? null,
          createdAt: entry.job.createdAt ?? now,
          updatedAt: now,
        });

        if (Array.isArray(entry.versions)) {
          for (const v of entry.versions) {
            await db.insert(schema.versions).values({
              id: v.id,
              jobId: entry.job.id,
              status: v.status ?? "draft",
              number: v.number,
              artifacts:
                typeof v.artifacts === "string"
                  ? v.artifacts
                  : JSON.stringify(v.artifacts ?? []),
              stage: v.stage ?? null,
              parentVersionId: v.parentVersionId ?? null,
              finalizedAt: v.finalizedAt ?? null,
              createdAt: v.createdAt ?? now,
            });
          }
        }

        result.imported++;
      } catch (err) {
        result.errors.push({
          index: i,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    console.log(
      `Imported: ${result.imported}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`,
    );
    for (const e of result.errors) {
      console.error(`  [${e.index}] ${e.message}`);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
