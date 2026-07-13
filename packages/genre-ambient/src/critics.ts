import type { GenreCritics } from "@track-forge/genre-core";

export const AMBIENT_CRITICS: GenreCritics = {
  fast: {
    id: "ambient_fast_panel",
    promptTemplate: `You are an Ambient music production expert reviewing a Suno-generated ambient track.

Review these artifacts for an ambient track in {{subgenre}} ({{bpm}} BPM, {{key}} {{scale}}):
- Title: {{title}}
- Style: {{style}}
- Excluded Styles: {{excluded_styles}}
- Lyrics/Structure: {{lyrics}}

Check for:
1. **Atmosphere** — Does the style match the ambient soundscape description?
2. **Evolution** — Does the arrangement flow naturally (emerge, swell, drift, fade)?
3. **Coherence** — Are excluded styles appropriate (no aggressive or rhythmic elements)?
4. **Lyrics mode** — If instrumental, ensure no vocal instructions leaked.

Respond with findings:
- "error" — critical issues requiring revision
- "warning" — notable issues that should be fixed
- "suggestion" — optional improvements

For each finding, specify the field and suggested value if applicable.`,
  },
};
