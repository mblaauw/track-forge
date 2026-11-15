import {
  SUNO_MODELS,
  SUNO_MODEL_INFO,
  SUNO_VARIETY_LEVELS,
  DEFAULT_SUNO_MODEL,
  DEFAULT_SUNO_VARIETY,
  type SunoModel,
  type SunoRenderSettings,
} from "@track-forge/contracts";
import { useSession } from "../../lib/session";
import { Segmented } from "./ui";

/** "v6 wild, High" — which model and variety a take uses. */
export function renderSummary(r: SunoRenderSettings): string {
  const model = SUNO_MODEL_INFO[r.model ?? DEFAULT_SUNO_MODEL].label;
  const variety =
    SUNO_VARIETY_LEVELS[r.variety ?? DEFAULT_SUNO_VARIETY]?.label ?? "Exact";
  return `${model}, ${variety.toLowerCase()}`;
}

/**
 * Per-take Suno settings. They apply to the next take rendered and are not
 * part of the forged prompt, so one version can be re-rendered on another
 * model or variety.
 */
export function RenderSettings() {
  const s = useSession();
  const r = s.render;
  const set = (patch: Partial<SunoRenderSettings>) =>
    s.setSession({ render: { ...r, ...patch } });
  const model = r.model ?? DEFAULT_SUNO_MODEL;
  const variety = r.variety ?? DEFAULT_SUNO_VARIETY;

  return (
    <div class="render-settings">
      <p class="menu-title">Settings for the next take</p>
      <div class="field">
        <span class="field-label">Model</span>
        <Segmented<SunoModel>
          label="Suno model"
          size="sm"
          value={model}
          options={SUNO_MODELS.map((m) => ({
            value: m,
            label: SUNO_MODEL_INFO[m].label,
          }))}
          testId={(m) => `render-model-${m}`}
          onChange={(m) => set({ model: m })}
        />
        <p class="field-hint">{SUNO_MODEL_INFO[model].hint}.</p>
      </div>

      <div class="field">
        <span class="field-label">Variety</span>
        <Segmented<number>
          label="Variety"
          size="sm"
          value={variety}
          options={SUNO_VARIETY_LEVELS.map((v) => ({
            value: v.value,
            label: v.label,
          }))}
          testId={(v) => `render-variety-${v}`}
          onChange={(v) => set({ variety: v })}
        />
        <p class="field-hint">
          {SUNO_VARIETY_LEVELS[variety]?.hint}.
          {variety > 0 &&
            " Above Exact, Suno rewrites the style prompt before rendering."}
        </p>
      </div>

      <Slider
        label="Weirdness"
        low="Safe"
        high="Chaos"
        testId="render-weirdness"
        value={r.weirdness}
        onChange={(weirdness) => set({ weirdness })}
      />
      <Slider
        label="Style influence"
        low="Loose"
        high="Strong"
        testId="render-style-influence"
        value={r.styleInfluence}
        onChange={(styleInfluence) => set({ styleInfluence })}
      />
    </div>
  );
}

function Slider({
  label,
  low,
  high,
  testId,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  testId: string;
  /** 0–1, or undefined to leave the choice to Suno. */
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const isSet = value !== undefined;
  const pct = Math.round((value ?? 0.5) * 100);
  return (
    <div class="field">
      <div class="field-head">
        <span class="field-label">{label}</span>
        <span class="field-aside">
          {isSet ? `${pct}%` : "Suno decides"}
          {isSet && (
            <button
              type="button"
              class="link"
              onClick={() => onChange(undefined)}
            >
              Reset
            </button>
          )}
        </span>
      </div>
      <div class="slider-row">
        <span>{low}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          aria-label={label}
          data-testid={testId}
          class={`range${isSet ? "" : " range-unset"}`}
          onInput={(e) =>
            onChange(Number((e.target as HTMLInputElement).value) / 100)
          }
        />
        <span>{high}</span>
      </div>
    </div>
  );
}
