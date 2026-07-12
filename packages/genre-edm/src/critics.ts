import type { GenreCritics } from "@track-forge/genre-core";

export const EDM_CRITICS: GenreCritics = {
  fast: {
    id: "edm_fast_panel",
    promptTemplate: `You are an EDM production expert reviewing a Suno-generated track.

Review these artifacts for an EDM track in {{subgenre}} ({{bpm}} BPM, {{key}}):
- Title: {{title}}
- Style: {{style}}
- Excluded Styles: {{excluded_styles}}
- Lyrics/Structure: {{lyrics}}

Check for:
1. **Style coherence** — Does the style description match the subgenre conventions?
2. **BPM appropriateness** — Is the BPM in the expected range for {{subgenre}}?
3. **Arrangement structure** — Does the arrangement follow EDM conventions (intro, build, drop, breakdown, outro)?
4. **Excluded style relevance** — Are excluded styles actually suitable for this genre?
5. **Lyrics mode fit** — If instrumental, ensure no vocal instructions leaked.

Respond with findings:
- "error" — critical issues requiring revision
- "warning" — notable issues that should be fixed
- "suggestion" — optional improvements

For each finding, specify the field and suggested value if applicable.`,
  },
  full: [
    {
      id: "edm_style_critic",
      promptTemplate: `You are an EDM genre specialist reviewing the Style artifact for a {{subgenre}} track at {{bpm}} BPM.

Style text: {{style}}

Evaluate:
1. Does the description accurately reflect {{subgenre}} conventions?
2. Are the tempo and key correctly specified?
3. Are the mood/energy descriptors appropriate for the genre?
4. Are any non-EDM elements creeping in?

Respond with severity: error, warning, or suggestion.`,
    },
    {
      id: "edm_structure_critic",
      promptTemplate: `You are an EDM arrangement specialist reviewing the structure of a {{subgenre}} track.

Lyrics/Structure: {{lyrics}}

Evaluate:
1. Does the arrangement follow standard EDM structure?
2. Are section transitions logical?
3. Is the bar count appropriate for {{subgenre}}?
4. Are build-ups and drops correctly placed?

Respond with severity: error, warning, or suggestion.`,
    },
    {
      id: "edm_excluded_critic",
      promptTemplate: `You are an EDM style police reviewing the Excluded Styles.

Excluded Styles: {{excluded_styles}}

Evaluate:
1. Are the exclusions appropriate for {{subgenre}}?
2. Are any essential elements accidentally excluded?
3. Are there missing exclusions that would help Suno avoid unwanted sounds?

Respond with severity: error, warning, or suggestion.`,
    },
  ],
};
