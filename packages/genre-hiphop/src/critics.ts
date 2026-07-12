import type { CriticDefinition } from "@track-forge/genre-core";

// ── Fast panel critic ─────────────────────────────────────────────────

export const HIP_HOP_FAST_CRITIC: CriticDefinition = {
  id: "hiphop_fast_panel",
  promptTemplate: `You are a Hip-Hop music critic reviewing generated song artifacts.

Review the following Hip-Hop track artifacts for quality:
- Subgenre: {{subgenre}}
- BPM: {{bpm}}
- Narrative Arc: {{narrativeArc}}
- Flow: {{flowPattern}}
- Delivery: {{delivery}}
- Production: {{productionStyle}}
- Energy: {{energy}}/10
- Lyrical Complexity: {{complexity}}/10

Check these aspects:
1. **Style coherence**: Does the style description match the selected subgenre?
2. **BPM accuracy**: Is the BPM appropriate for the subgenre?
3. **Narrative fit**: Does the narrative arc suit the style?
4. **Flow & delivery**: Are the flow pattern and delivery appropriate?
5. **Exclusions**: Are excluded styles relevant?
6. **Lyrics mode**: If instrumental, are lyrics empty? If full, are lyrics structured?

For each issue, specify severity (error/warning/suggestion), the affected field, and a suggested fix.`,
};

// ── Full critics ──────────────────────────────────────────────────────

export const HIP_HOP_FULL_CRITICS: CriticDefinition[] = [
  {
    id: "hiphop_style_critic",
    promptTemplate: `You are a Hip-Hop style expert. Review the generated style description.

Subgenre: {{subgenre}}
BPM: {{bpm}} | Key: {{key}} {{scale}}
Mood: {{mood}}
Narrative Arc: {{narrativeArc}}
Flow: {{flowPattern}} | Delivery: {{delivery}}
Production: {{productionStyle}}
Energy: {{energy}}/10 | Complexity: {{complexity}}/10

Check:
1. Does the style description accurately represent the subgenre?
2. Are the BPM and key appropriate?
3. Are the flow and delivery descriptions consistent?
4. Are the tags relevant and complete?
5. Does the production style description match?

Provide findings with severity, field, and suggested fixes.`,
  },
  {
    id: "hiphop_structure_critic",
    promptTemplate: `You are a Hip-Hop song structure expert. Review the generated lyrics/structure.

Subgenre: {{subgenre}}
Narrative Arc: {{narrativeArc}}
Flow: {{flowPattern}}
Energy: {{energy}}/10
Complexity: {{complexity}}/10
Song Structure: {{songStructure}}

Check:
1. Is the song structure appropriate for the subgenre?
2. Does the structure support the narrative arc?
3. Are verse/hook lengths balanced?
4. Is the flow pattern aligned with the lyrical density?
5. Does the energy level match the section progression?

Provide findings with severity, field, and suggested fixes.`,
  },
  {
    id: "hiphop_excluded_style_critic",
    promptTemplate: `You are a Hip-Hop style consultant. Review the excluded styles.

Subgenre: {{subgenre}}
Production Style: {{productionStyle}}
Energy: {{energy}}/10
Lyrical Complexity: {{complexity}}/10
Negative Tags: {{negativeTags}}

Check:
1. Are the excluded styles appropriate for this subgenre?
2. Are there any missing exclusions that would improve the track?
3. Are any excluded styles contradictory to the subgenre's core identity?

Provide findings with severity, field, and suggested fixes.`,
  },
];

// ── Originality critic (conditional on references) ───────────────────

export const HIP_HOP_ORIGINALITY_CRITIC: CriticDefinition = {
  id: "hiphop_originality",
  promptTemplate: `You are an originality/comparison expert reviewing Hip-Hop tracks against references.

Subgenre: {{subgenre}}
Reference tracks: {{reference}}

Check:
1. Does the generated style derivative from the reference tracks?
2. Are there unique elements that distinguish this track?
3. Does it bring something new to the subgenre while honoring the reference?
4. Are there any direct copy elements that should be revised?

Provide findings with severity and suggested revisions to increase originality.`,
};
