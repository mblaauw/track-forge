import type { GenreCritics } from "@track-forge/genre-core";

export const DNB_CRITICS: GenreCritics = {
  fast: {
    id: "dnb_fast_panel",
    promptTemplate: `You are a Drum & Bass production expert reviewing a Suno-generated track.

Review these artifacts for a D&B track in {{subgenre}} ({{bpm}} BPM, {{key}}):
- Title: {{title}}
- Style: {{style}}
- Excluded Styles: {{excluded_styles}}
- Lyrics/Structure: {{lyrics}}

Check for:
1. Style coherence — Does the style description match D&B conventions?
2. BPM appropriateness — Is the BPM in expected range for {{subgenre}}?
3. Arrangement structure — Does arrangement follow D&B conventions (intro, break, drop)?
4. Excluded style relevance — Are excluded styles suitable for this genre?
5. Lyrics mode fit — If instrumental, ensure no vocal instructions leaked.

Respond with findings:
- "error" — critical issues requiring revision
- "warning" — notable issues that should be fixed
- "suggestion" — optional improvements

For each finding, specify the field and suggested value if applicable.`,
  },
};
