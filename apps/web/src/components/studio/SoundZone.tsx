import { useState } from "preact/hooks";
import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react";
import type { GenreData } from "../../lib/genre-data";
import { useGenres } from "../../lib/genre-data";
import { useSession, type SessionState } from "../../lib/session";
import type { GenrePreset } from "../../api";
import { buildSections } from "./arrangement";
import type { Descriptor, DescriptorCategory, DescriptorWeight } from "./types";
import { Field, Popover, Segmented, sentenceCase } from "./ui";

/**
 * A preset is a real starting point, not a label: choosing one brings its
 * tempo, vocal mode, energy and complexity into the session.
 */
export function presetSessionPatch(preset: GenrePreset): Partial<SessionState> {
  const v = preset.values as {
    bpm?: number;
    lyricsMode?: "full_lyrics" | "strict_instrumental";
    energy?: number;
    complexity?: number;
  };
  const patch: Partial<SessionState> = {
    presetIds: [preset.id],
    presetId: preset.id,
    presetLabels: [preset.name],
  };
  if (typeof v.bpm === "number") patch.bpm = v.bpm;
  if (v.lyricsMode === "full_lyrics" || v.lyricsMode === "strict_instrumental")
    patch.lyricsMode = v.lyricsMode;
  if (typeof v.energy === "number") patch.energy = v.energy;
  if (typeof v.complexity === "number") patch.complexity = v.complexity;
  return patch;
}

export function defaultDescriptors(
  defaults: { label: string; cat: string; weight: number }[],
): Descriptor[] {
  return defaults.map((d) => ({
    id: d.label,
    label: d.label,
    cat: d.cat as DescriptorCategory,
    weight: d.weight as DescriptorWeight,
    muted: false,
  }));
}

/** Off → 1 → 2 → 3 → off. */
function cycleDescriptor(
  tags: Descriptor[],
  label: string,
  cat: DescriptorCategory,
): Descriptor[] {
  // A label can appear in more than one lane ("smooth" is both a mood and
  // an energy), so a trait is identified by lane and label together.
  const same = (t: Descriptor) => t.label === label && t.cat === cat;
  const existing = tags.find(same);
  if (!existing) {
    return [
      ...tags,
      { id: `${cat}:${label}`, label, cat, weight: 1, muted: false },
    ];
  }
  if (existing.weight >= 3) return tags.filter((t) => !same(t));
  return tags.map((t) =>
    same(t) ? { ...t, weight: (t.weight + 1) as DescriptorWeight } : t,
  );
}

const WEIGHT_WORD = ["", "a touch", "present", "defining"];

export function SoundZone({ data }: { data: GenreData | null }) {
  const s = useSession();
  const genres = useGenres();
  const presets = data?.presets ?? [];
  const vocab = data?.vocab;
  const preset = presets.find((p) => p.id === (s.presetId || s.presetIds[0]));
  const active = s.tags.filter((t) => !t.muted);

  const choosePreset = (p: GenrePreset) => {
    const patch = presetSessionPatch(p);
    // Follow the new preset's arrangement — unless the user has shaped
    // their own, which a preset switch must not silently discard.
    if (s.arrangeSource !== "custom" && vocab) {
      const sections = buildSections(
        p.songStructure ?? vocab.songStructure,
        patch.energy ?? s.energy,
        patch.complexity ?? s.complexity,
      );
      Object.assign(patch, {
        sections,
        selSectionId: sections[0]?.id ?? null,
        lyricsGenerated: false,
        lyricLines: {},
      });
    }
    s.setSession(patch);
  };

  return (
    <div class="zone-inner">
      <header class="zone-head">
        <h2 class="zone-title">Sound</h2>
        <p class="zone-sub">How the track should sound, start to finish.</p>
      </header>

      <div class="field genre-field">
        <span class="field-label">Genre</span>
        <Segmented
          label="Genre"
          value={s.genreId}
          options={genres.map((g) => ({ value: g.id, label: g.name }))}
          testId={(id) => `genre-chip-${id}`}
          onChange={(genreId) => {
            if (genreId === s.genreId) return;
            // Sections and descriptors are rebuilt from the new genre's
            // own data once it has loaded (see Studio).
            s.setSession({
              genreId,
              presetId: "",
              presetIds: [],
              presetLabels: [],
              tags: [],
              sections: [],
              selSectionId: null,
              arrangeSource: "default",
              lyricThemes: [],
              lyricsGenerated: false,
              lyricLines: {},
            });
          }}
        />
      </div>

      <div class="field">
        <span class="field-label" id="preset-label">
          Preset
        </span>
        <PresetPicker
          presets={presets}
          current={preset}
          onChoose={choosePreset}
        />
        {preset?.description && <p class="field-hint">{preset.description}</p>}
      </div>

      <div class="character">
        <div class="field-head">
          <span class="field-label">Character</span>
          <span class="field-aside">
            {active.length} on
            {vocab && (
              <button
                type="button"
                class="link"
                onClick={() =>
                  s.setSession({ tags: defaultDescriptors(vocab.defaults) })
                }
              >
                Reset
              </button>
            )}
          </span>
        </div>
        <p class="field-hint">
          Click to add a trait. Click again to make it stronger; a third click
          removes it.
        </p>
        {(vocab?.categories ?? []).map((cat) => (
          <div
            class="lane"
            key={cat.cat}
            style={{ "--lane": cat.hue }}
            role="group"
            aria-label={sentenceCase(cat.label)}
          >
            <span class="lane-label">{sentenceCase(cat.label)}</span>
            <div class="chip-row">
              {cat.chips.map((chip) => {
                const tag = s.tags.find(
                  (t) => t.label === chip && t.cat === cat.cat && !t.muted,
                );
                const weight = tag?.weight ?? 0;
                return (
                  <button
                    key={chip}
                    type="button"
                    class={`trait${weight ? ` trait-on w${weight}` : ""}`}
                    aria-pressed={weight > 0}
                    aria-label={
                      weight
                        ? `${chip}: ${WEIGHT_WORD[weight]}`
                        : `${chip}: off`
                    }
                    title={
                      weight
                        ? `${chip} — ${WEIGHT_WORD[weight]} (${weight} of 3)`
                        : `Add ${chip}`
                    }
                    onClick={() =>
                      s.setSession({
                        tags: cycleDescriptor(
                          s.tags,
                          chip,
                          cat.cat as DescriptorCategory,
                        ),
                      })
                    }
                  >
                    <span class="trait-level" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Field
        label="Avoid"
        hint="Sounds to keep out, separated by commas. Sent to Suno as exclusions."
      >
        {(id) => (
          <input
            id={id}
            class="input"
            placeholder="autotune, distortion, orchestral swells"
            data-testid="avoid-input"
            value={s.excludedStyles}
            onInput={(e) =>
              s.setSession({
                excludedStyles: (e.target as HTMLInputElement).value,
              })
            }
          />
        )}
      </Field>

      <Field
        label="Notes"
        hint="Kept with this session for your own reference. Not sent to Suno."
      >
        {(id) => (
          <textarea
            id={id}
            class="input textarea"
            rows={2}
            placeholder="Reference tracks, ideas to try next"
            value={s.reference}
            onInput={(e) =>
              s.setSession({
                reference: (e.target as HTMLTextAreaElement).value,
              })
            }
          />
        )}
      </Field>
    </div>
  );
}

function PresetPicker({
  presets,
  current,
  onChoose,
}: {
  presets: GenrePreset[];
  current: GenrePreset | undefined;
  onChoose: (preset: GenrePreset) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = presets.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q),
  );

  return (
    <Popover
      label="Choose a preset"
      panelClass="preset-pop"
      trigger={({ toggle, ref, open: _open, ...aria }) => (
        <button
          type="button"
          class="picker-btn"
          ref={ref}
          aria-labelledby="preset-label preset-current"
          data-testid="preset-picker"
          onClick={() => {
            setQuery("");
            toggle();
          }}
          {...aria}
        >
          <span id="preset-current">{current?.name ?? "Choose a preset"}</span>
          <CaretDown size={15} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div class="search">
            <MagnifyingGlass size={15} />
            <input
              class="search-input"
              placeholder={`Search ${presets.length} presets`}
              aria-label="Search presets"
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            />
          </div>
          <ul class="option-list" data-testid="preset-list">
            {shown.map((p) => {
              const on = p.id === current?.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    class={`option${on ? " on" : ""}`}
                    data-testid={`preset-${p.id}`}
                    aria-current={on ? "true" : undefined}
                    onClick={() => {
                      if (!on) onChoose(p);
                      close();
                    }}
                  >
                    <span class="option-name">{p.name}</span>
                    <span class="option-desc">{p.description}</span>
                    {on && <Check size={15} class="option-check" />}
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && (
              <li class="option-empty">No preset matches that search.</li>
            )}
          </ul>
        </>
      )}
    </Popover>
  );
}
