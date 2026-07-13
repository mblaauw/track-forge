import type { GenreCritics } from "@track-forge/genre-core";

export const POP_CRITICS: GenreCritics = {
  fast: {
    id: "pop_fast_panel",
    promptTemplate: `You are a Pop music production expert reviewing a Suno-generated track.

Review these artifacts for a {{subgenre}} Pop track ({{bpm}} BPM, {{key}}):
- Title: {{title}}
- Style: {{style}}
- Excluded Styles: {{excluded_styles}}
- Lyrics/Structure: {{lyrics}}

Check for:
1. **Pop conventions** — Does the style description follow Pop conventions (verse-chorus structure, hook focus)?
2. **BPM appropriateness** — Is the BPM in the expected range for {{subgenre}}?
3. **Arrangement structure** — Does the arrangement follow Pop song structure?
4. **Excluded style relevance** — Are excluded styles suitable for this genre?
5. **Lyrics mode fit** — If instrumental, ensure no vocal instructions leaked.

Respond with findings:
- "error" — critical issues requiring revision
- "warning" — notable issues that should be fixed
- "suggestion" — optional improvements

For each finding, specify the field and suggested value if applicable.`,
  },
};
