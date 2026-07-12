import { useState, useEffect } from "preact/hooks";
import { fetchGenres, createJob, updateJobInputs, type GenreInfo, type JobInfo } from "../api";
import { useRouter } from "../lib/router";
import { DynamicForm } from "../components/DynamicForm";
import type { FormFieldDescriptor } from "@track-forge/genre-core";
import { useAutosave } from "../lib/useAutosave";
import { AutoSaveIndicator } from "../components/AutoSaveIndicator";

/** Import genre modules for form field definitions */
import { edmModule } from "@track-forge/genre-edm";
import { hipHopModule } from "@track-forge/genre-hiphop";
import { getAllFamilyOptions, getSubgenreOptions, type EdmFamily } from "@track-forge/genre-edm";

const GENRE_MODULES: Record<string, { form: FormFieldDescriptor[]; presets: { id: string; name: string; description: string; values: Record<string, unknown> }[]; defaults: Record<string, unknown> }> = {
  edm: {
    form: edmModule.form,
    presets: edmModule.presets,
    defaults: edmModule.defaults as unknown as Record<string, unknown>,
  },
  hiphop: {
    form: hipHopModule.form,
    presets: hipHopModule.presets,
    defaults: hipHopModule.defaults as unknown as Record<string, unknown>,
  },
};

export function CreateJob() {
  const { navigate } = useRouter();
  const [genres, setGenres] = useState<GenreInfo[]>([]);
  const [genreId, setGenreId] = useState("edm");
  const [presetId, setPresetId] = useState("");
  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [projectName, setProjectName] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  // Autosave after creation — monitor inputs + name changes
  const saveExisting = createdJobId
    ? () => updateJobInputs(createdJobId, { inputs, name: projectName || undefined })
    : null;
  const autoSaveStatus = useAutosave(
    createdJobId ? { inputs, projectName } : null,
    async () => {
      if (createdJobId) await updateJobInputs(createdJobId, { inputs, name: projectName || undefined });
    },
  );

  useEffect(() => {
    fetchGenres().then(setGenres).catch(() => {});
  }, []);

  // Load defaults when genre changes
  useEffect(() => {
    const mod = GENRE_MODULES[genreId];
    if (mod) {
      setInputs({ ...mod.defaults });
      setPresetId("");
    }
  }, [genreId]);

  const mod = GENRE_MODULES[genreId];
  const selectedPreset = mod?.presets.find((p) => p.id === presetId);

  // Apply preset values
  useEffect(() => {
    if (selectedPreset) {
      setInputs((prev) => ({ ...prev, ...selectedPreset.values }));
    }
  }, [presetId]);

  const selectedGenre = genres.find((g) => g.id === genreId);

  // EDM-specific: dynamic family → subgenre options
  const getFieldOptions = () => {
    if (genreId !== "edm") return undefined;
    const family = inputs.family as string;
    if (!family) return undefined;
    return {
      subgenre: getSubgenreOptions(family as EdmFamily),
      // Populate family dropdown so user sees labels
      family: getAllFamilyOptions(),
    };
  };

  const handleChange = (key: string, value: unknown) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!genreId || !mod) return;
    setSubmitting(true);
    setError(null);
    try {
      const job: JobInfo = await createJob({
        genreId,
        presetId: presetId || mod.presets[0]?.id || "",
        inputs,
        reference: reference || undefined,
        name: projectName || undefined,
      });
      // After creation, future edits auto-save
      setCreatedJobId(job.id);
      navigate(`/job/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="page-shell">
      <section class="page-hero">
        <div>
          <p class="hero-kicker">Create</p>
          <h2>New Project</h2>
          <p class="hero-copy">Choose a genre, tune inputs, and keep the reference material close at hand.</p>
          <div class="hero-metrics">
            <span class="metric-pill">Genre: {selectedGenre?.name ?? genreId}</span>
            <span class="metric-pill">Preset: {selectedPreset?.name ?? "Custom"}</span>
            <span class="metric-pill">Autosaves after create</span>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} class="create-form surface-card">
        <div class="form-intro">
          <p class="section-kicker">Project brief</p>
          <h3>Set up generation inputs</h3>
          <p class="section-copy">Start with naming, genre, and preset, then fill out the generated controls.</p>
        </div>

        {/* Project name */}
        <div class="form-field">
          <label>Project Name</label>
          <input
            type="text"
            value={projectName}
            onInput={(e) => setProjectName((e.target as HTMLInputElement).value)}
            placeholder="My Song"
          />
        </div>

        <div class="form-grid">
          {/* Genre selection */}
          <div class="form-field">
            <label>Genre</label>
            <select value={genreId} onChange={(e) => setGenreId((e.target as HTMLSelectElement).value)}>
              {genres.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Preset selection */}
          {mod && mod.presets.length > 0 && (
            <div class="form-field">
              <label>Preset</label>
              <select value={presetId} onChange={(e) => setPresetId((e.target as HTMLSelectElement).value)}>
                <option value="">— Custom —</option>
                {mod.presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {selectedPreset && <p class="hint">{selectedPreset.description}</p>}
            </div>
          )}
        </div>

        {/* Dynamic inputs from genre module */}
        {mod && (
          <div class="form-section">
            <div class="form-section-header">
              <div>
                <p class="section-kicker">Genre controls</p>
                <h3>Style and structure</h3>
              </div>
            </div>
            <DynamicForm fields={mod.form} values={inputs} onChange={handleChange} fieldOptions={getFieldOptions()} />
          </div>
        )}

        {/* Reference */}
        <div class="form-section">
          <div class="form-section-header">
            <div>
              <p class="section-kicker">Reference</p>
              <h3>Tracks, lyrics, or notes</h3>
              <p class="section-copy">Optional source material helps the pipeline keep direction and tone aligned.</p>
            </div>
          </div>
          <div class="form-field">
            <label>Reference Tracks / Lyrics</label>
            <textarea
              rows={3}
              value={reference}
              onInput={(e) => setReference((e.target as HTMLTextAreaElement).value)}
              placeholder="Optional reference material…"
            />
          </div>
        </div>

        {error && <p class="error">{error}</p>}

        <div class="form-actions form-actions-spread">
          <button type="submit" class="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create Job"}
          </button>
          <div class="form-actions-meta">
            {createdJobId ? <AutoSaveIndicator status={autoSaveStatus} /> : <span class="muted">Autosave starts after creation.</span>}
          </div>
        </div>
      </form>
    </div>
  );
}
