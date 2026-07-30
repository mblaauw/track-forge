import type { PromptManifest } from "./lyrics-writer.js";
import type { Db } from "../db/index.js";
import { getSqlite } from "../db/index.js";

export interface PromptTraceLink {
  jobId?: string;
  intentRevisionId?: string;
  compilationId?: string;
}

export function recordPromptManifest(
  db: Db,
  manifest: PromptManifest,
  link: PromptTraceLink = {},
): void {
  const sqlite = getSqlite(db);
  sqlite
    .prepare(
      `INSERT OR REPLACE INTO prompt_traces (
        id,
        job_id,
        intent_revision_id,
        compilation_id,
        provider,
        model,
        prompt_id,
        prompt_version,
        prompt_source_path,
        prompt_source_hash,
        system_prompt_hash,
        user_prompt_hash,
        response_schema_version,
        genre,
        preset,
        pipeline_version,
        git_commit,
        status,
        failure_type,
        failure_message,
        retry_count,
        parsing_failures,
        validation_failures,
        repair_attempts,
        latency_ms,
        token_usage_json,
        attempts_json,
        manifest_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      manifest.traceId,
      link.jobId ?? null,
      link.intentRevisionId ?? null,
      link.compilationId ?? null,
      manifest.provider,
      manifest.model,
      manifest.promptId,
      manifest.promptVersion,
      manifest.promptSourcePath,
      manifest.promptSourceHash,
      manifest.systemPromptHash,
      manifest.userPromptHash,
      manifest.responseSchemaVersion,
      manifest.genre,
      manifest.preset ?? null,
      manifest.pipelineVersion,
      manifest.gitCommit ?? null,
      manifest.status,
      manifest.failureType ?? null,
      manifest.failureMessage ?? null,
      manifest.retryCount,
      manifest.parsingFailures,
      manifest.validationFailures,
      manifest.repairAttempts,
      manifest.latencyMs,
      manifest.tokenUsage ? JSON.stringify(manifest.tokenUsage) : null,
      JSON.stringify(manifest.attempts),
      JSON.stringify(manifest),
      manifest.createdAt,
    );
}
