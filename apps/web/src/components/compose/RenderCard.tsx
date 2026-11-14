import {
  SUNO_MODELS,
  SUNO_MODEL_INFO,
  SUNO_VARIETY_LEVELS,
  DEFAULT_SUNO_MODEL,
  DEFAULT_SUNO_VARIETY,
  type SunoRenderSettings,
} from "@track-forge/contracts";
import type { useSession } from "../../lib/session";

/** One-line summary shown on the collapsed Render card. */
export function renderSummary(r: SunoRenderSettings): string {
  const model = SUNO_MODEL_INFO[r.model ?? DEFAULT_SUNO_MODEL].label;
  const variety =
    SUNO_VARIETY_LEVELS[r.variety ?? DEFAULT_SUNO_VARIETY]?.label ?? "Exact";
  return `${model} · ${variety}`;
}

/**
 * Per-take Suno v6 settings. These apply to the next take rendered — they
 * are not part of the forged bundle, so the same bundle can be re-rendered
 * with a different model or variety from the Takes panel.
 */
export function RenderCardContent({ s }: { s: ReturnType<typeof useSession> }) {
  const r = s.render;
  const set = (patch: Partial<SunoRenderSettings>) =>
    s.setSession({ render: { ...r, ...patch } });
  const model = r.model ?? DEFAULT_SUNO_MODEL;
  const variety = r.variety ?? DEFAULT_SUNO_VARIETY;

  return (
    <>
      <div class="setup-eyebrow">MODEL</div>
      <div class="setup-chip-row" role="radiogroup" aria-label="Suno model">
        {SUNO_MODELS.map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={model === m}
            data-testid={`render-model-${m}`}
            class={`setup-chip${model === m ? " active-dark" : ""}`}
            onClick={() => set({ model: m })}
          >
            {SUNO_MODEL_INFO[m].label}
          </button>
        ))}
      </div>
      <p class="setup-hint">{SUNO_MODEL_INFO[model].hint}.</p>

      <div class="setup-eyebrow">VARIETY</div>
      <div class="setup-chip-row" role="radiogroup" aria-label="Variety">
        {SUNO_VARIETY_LEVELS.map((v) => (
          <button
            key={v.value}
            role="radio"
            aria-checked={variety === v.value}
            data-testid={`render-variety-${v.value}`}
            class={`setup-chip${variety === v.value ? " active-dark" : ""}`}
            onClick={() => set({ variety: v.value })}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p class="setup-hint">
        {SUNO_VARIETY_LEVELS[variety]?.hint}.
        {variety > 0 &&
          " Above Exact, Suno rewrites the compiled style before rendering."}
      </p>

      <RenderSlider
        label="WEIRDNESS"
        testId="render-weirdness"
        low="Safe"
        high="Chaos"
        value={r.weirdness}
        onChange={(weirdness) => set({ weirdness })}
      />
      <RenderSlider
        label="STYLE INFLUENCE"
        testId="render-style-influence"
        low="Loose"
        high="Strong"
        value={r.styleInfluence}
        onChange={(styleInfluence) => set({ styleInfluence })}
      />
      <p class="setup-hint">Applies to the next take you render.</p>
    </>
  );
}

function RenderSlider({
  label,
  testId,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  testId: string;
  low: string;
  high: string;
  /** 0–1, or undefined to leave the choice to Suno. */
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const isSet = value !== undefined;
  const pct = Math.round((value ?? 0.5) * 100);
  return (
    <>
      <div class="setup-eyebrow render-slider-head">
        <span>{label}</span>
        <span class="render-slider-value">
          {isSet ? `${pct}%` : "Suno default"}
        </span>
        {isSet && (
          <button class="setup-link-btn" onClick={() => onChange(undefined)}>
            Reset
          </button>
        )}
      </div>
      <div class="render-slider-row">
        <span>{low}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          aria-label={label.toLowerCase()}
          data-testid={testId}
          class={`arr-bpm-slider render-slider${isSet ? "" : " unset"}`}
          onInput={(e) =>
            onChange(Number((e.target as HTMLInputElement).value) / 100)
          }
        />
        <span>{high}</span>
      </div>
    </>
  );
}
