import type { CompileStyleInput } from "./style-compiler.js";
import type {
  MaterializedIntent,
  PresetCatalog,
} from "@track-forge/song-intent";

/**
 * Bridge: `MaterializedIntent → CompileStyleInput`
 *
 * Converts the canonical typed intent to what the current style compiler
 * expects. This is a transitional adapter — Phase 4 will replace
 * `compileStylePrompt(CompileStyleInput)` with `renderSunoStyle(ResolvedSongIntent)`
 * and this bridge disappears.
 */
export function materializedToCompileStyleInput(
  m: MaterializedIntent,
  catalog: PresetCatalog,
  genreName: string,
): CompileStyleInput {
  const intent = m.intent;
  const presetLabels = resolvePresetLabels(intent.styles, catalog);

  return {
    genreName,
    presetLabels,
    descriptors: intent.musical.descriptors,
    bpm: intent.musical.bpm ?? 128,
    sections: intent.arrangement.sections.map((s) => ({
      name: s.name,
      fn: s.fn,
    })),
    lyricsMode: intent.vocals.mode,
    vocalType: intent.vocals.type || undefined,
    characteristics:
      intent.musical.characteristics.length > 0
        ? intent.musical.characteristics
        : undefined,
    tempoFeel: intent.musical.tempoFeel || undefined,
    flowPattern: intent.lyrics.flowPattern || undefined,
    presetMood: intent.musical.mood || undefined,
    presetEnergy:
      intent.musical.energy !== undefined ? intent.musical.energy : undefined,
    hipHopFlowPattern: intent.lyrics.flowPattern || undefined,
    hipHopRhymeStyle: intent.lyrics.rhymeStyle || undefined,
    hipHopNarrativeArc: intent.lyrics.narrativeArc || undefined,
    hipHopVocalStyle: intent.lyrics.vocalStyle || undefined,
    hipHopTypicalSongStructure: intent.arrangement.typicalSongStructure,
  };
}

function resolvePresetLabels(
  styles: MaterializedIntent["intent"]["styles"],
  catalog: PresetCatalog,
): string[] {
  const labels: string[] = [];
  for (const s of styles) {
    const preset = catalog.getPreset(s.genreId, s.presetId);
    if (preset) labels.push(preset.name);
  }
  return labels;
}
