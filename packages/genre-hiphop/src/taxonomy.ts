// ── Hip-Hop subgenre taxonomy ─────────────────────────────────────────

export type NarrativeArc =
  | "storytelling"
  | "braggadocio"
  | "conscious"
  | "party"
  | "introspective"
  | "abstract";

export type RhymeStyle =
  "multi_syllabic" | "end_rhyme" | "internal" | "free_form" | "slant_rhyme";

export type FlowPattern =
  | "laid_back"
  | "aggressive"
  | "syncopated"
  | "double_time"
  | "melodic"
  | "mumble";

export type Delivery =
  "calm" | "intense" | "conversational" | "hype" | "whispered";

export type ProductionStyle =
  | "lo_fi"
  | "polished"
  | "vintage"
  | "experimental"
  | "minimal"
  | "orchestral"
  | "electronic"
  | "live_instruments";

export interface HipHopSubgenreEntry {
  id: string;
  label: string;
  description?: string;
  bpmRange: [number, number];
  bpmDefault: number;
  era: string;
  characteristics: string[];
  defaultNarrative: NarrativeArc;
  defaultFlow: FlowPattern;
  defaultDelivery: Delivery;
  defaultProduction: ProductionStyle;
  commonRhymeStyles: RhymeStyle[];
  typicalSongStructure: string[];
  vocalStyle: string;
  tags: string[];
}

/**
 * Fallback for static init — full 22-entry set is duplicated from YAML taxonomy.
 * Validators use this via default parameter; augmented YAML is not passed in.
 * Shrinking to 1 entry would break validation for any non-boom_bap subgenre.
 * Fix: refactor validators/schema pipeline to consume runtime-augmented taxonomy.
 */
export const HIP_HOP_SUBGENRES: HipHopSubgenreEntry[] = [
  { id: "boom_bap", label: "Boom Bap", bpmRange: [85, 95], bpmDefault: 90, era: "1990s", characteristics: ["hard drums", "sampled loops", "gritty", "raw", "head-nod groove"], defaultNarrative: "braggadocio", defaultFlow: "laid_back", defaultDelivery: "intense", defaultProduction: "vintage", commonRhymeStyles: ["multi_syllabic", "end_rhyme", "internal"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "verse", "outro"], vocalStyle: "assertive, commanding delivery with precise phrasing", tags: ["boom bap", "east coast", "90s hip hop", "sampled"] },
  { id: "trap", label: "Trap", bpmRange: [130, 170], bpmDefault: 150, era: "2010s", characteristics: ["808 bass", "rolling hi-hats", "dark", "synth-heavy", "snare rolls"], defaultNarrative: "braggadocio", defaultFlow: "syncopated", defaultDelivery: "hype", defaultProduction: "polished", commonRhymeStyles: ["multi_syllabic", "end_rhyme", "free_form"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"], vocalStyle: "rhythmic, triplet flows with ad-libs and melodic hooks", tags: ["trap", "808", "hi-hats", "southern hip hop"] },
  { id: "drill", label: "Drill", bpmRange: [130, 160], bpmDefault: 145, era: "2010s", characteristics: ["sliding 808s", "minimal percussion", "aggressive", "dark", "raw"], defaultNarrative: "braggadocio", defaultFlow: "aggressive", defaultDelivery: "intense", defaultProduction: "minimal", commonRhymeStyles: ["end_rhyme", "multi_syllabic", "free_form"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "outro"], vocalStyle: "gritty, confrontational delivery with distinct cadence", tags: ["drill", "raw", "aggressive", "chicago drill", "uk drill"] },
  { id: "old_school", label: "Old School", bpmRange: [85, 100], bpmDefault: 92, era: "1980s", characteristics: ["breakbeats", "funk samples", "simple rhymes", "party vibe"], defaultNarrative: "party", defaultFlow: "laid_back", defaultDelivery: "conversational", defaultProduction: "lo_fi", commonRhymeStyles: ["end_rhyme", "internal"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "outro"], vocalStyle: "classic, rhythmic flow with clear enunciation", tags: ["old school", "breakbeats", "funk", "party"] },
  { id: "gangsta_rap", label: "Gangsta Rap", bpmRange: [80, 100], bpmDefault: 90, era: "1990s", characteristics: ["hard", "street narratives", "g-funk influence", "heavy bass"], defaultNarrative: "storytelling", defaultFlow: "laid_back", defaultDelivery: "intense", defaultProduction: "polished", commonRhymeStyles: ["end_rhyme", "multi_syllabic"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "outro"], vocalStyle: "deep, authoritative delivery with vivid storytelling", tags: ["gangsta rap", "west coast", "g-funk", "street"] },
  { id: "g_funk", label: "G-Funk", bpmRange: [85, 100], bpmDefault: 92, era: "1990s", characteristics: ["funky synths", "deep bass", "whistles", "smooth"], defaultNarrative: "braggadocio", defaultFlow: "laid_back", defaultDelivery: "conversational", defaultProduction: "polished", commonRhymeStyles: ["end_rhyme", "multi_syllabic"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"], vocalStyle: "laid-back, melodic delivery with harmonized hooks", tags: ["g-funk", "west coast", "funk", "synth"] },
  { id: "east_coast", label: "East Coast", bpmRange: [85, 100], bpmDefault: 93, era: "1990s", characteristics: ["lyrical", "complex wordplay", "hard drums", "jazz samples"], defaultNarrative: "conscious", defaultFlow: "laid_back", defaultDelivery: "conversational", defaultProduction: "vintage", commonRhymeStyles: ["multi_syllabic", "internal", "free_form"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "verse", "outro"], vocalStyle: "dense, lyrical delivery with intricate rhyme schemes", tags: ["east coast", "lyrical", "boom bap", "jazz rap"] },
  { id: "southern_hip_hop", label: "Southern Hip Hop", bpmRange: [70, 85], bpmDefault: 78, era: "2000s", characteristics: ["slow", "heavy bass", "laid-back", "chopped and screwed"], defaultNarrative: "braggadocio", defaultFlow: "laid_back", defaultDelivery: "conversational", defaultProduction: "polished", commonRhymeStyles: ["end_rhyme", "free_form"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "hook", "outro"], vocalStyle: "slow, slurred delivery with southern drawl", tags: ["southern hip hop", "chopped and screwed", "heavy bass", "crunk"] },
  { id: "crunk", label: "Crunk", bpmRange: [140, 165], bpmDefault: 155, era: "2000s", characteristics: ["energetic", "call and response", "heavy 808s", "party"], defaultNarrative: "party", defaultFlow: "aggressive", defaultDelivery: "hype", defaultProduction: "polished", commonRhymeStyles: ["end_rhyme", "multi_syllabic"], typicalSongStructure: ["intro", "hook", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"], vocalStyle: "loud, energetic delivery with call-and-response hooks", tags: ["crunk", "party", "southern", "energetic"] },
  { id: "hyphy", label: "Hyphy", bpmRange: [90, 110], bpmDefault: 100, era: "2000s", characteristics: ["upbeat", "energetic", "silly", "dance-oriented"], defaultNarrative: "party", defaultFlow: "aggressive", defaultDelivery: "hype", defaultProduction: "polished", commonRhymeStyles: ["end_rhyme", "free_form"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "hook", "outro"], vocalStyle: "high-energy, animated delivery with ad-libs", tags: ["hyphy", "bay area", "party", "dance"] },
  { id: "mumble_rap", label: "Mumble Rap", bpmRange: [120, 160], bpmDefault: 140, era: "2010s", characteristics: ["melodic", "auto-tune", "simplistic", "trap influence"], defaultNarrative: "braggadocio", defaultFlow: "mumble", defaultDelivery: "conversational", defaultProduction: "polished", commonRhymeStyles: ["free_form", "end_rhyme"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "hook", "outro"], vocalStyle: "melodic, auto-tuned delivery with slurred phrasing", tags: ["mumble rap", "trap", "melodic", "auto-tune"] },
  { id: "emo_rap", label: "Emo Rap", bpmRange: [70, 160], bpmDefault: 140, era: "2010s", characteristics: ["emotional", "rock influence", "melodic", "introspective"], defaultNarrative: "introspective", defaultFlow: "melodic", defaultDelivery: "conversational", defaultProduction: "polished", commonRhymeStyles: ["free_form", "end_rhyme", "internal"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"], vocalStyle: "emotional, melodic delivery with singing and screaming", tags: ["emo rap", "sad", "rock influence", "melodic"] },
  { id: "lo_fi_hip_hop", label: "Lo-fi Hip Hop", bpmRange: [70, 100], bpmDefault: 80, era: "2010s", characteristics: ["chill", "mellow", "jazz samples", "simple drums", "warm"], defaultNarrative: "introspective", defaultFlow: "laid_back", defaultDelivery: "calm", defaultProduction: "lo_fi", commonRhymeStyles: ["free_form", "end_rhyme", "internal"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "outro"], vocalStyle: "soft, relaxed delivery with gentle phrasing if present", tags: ["lo-fi", "chill", "jazz hop", "study beats"] },
  { id: "jazz_rap", label: "Jazz Rap", bpmRange: [75, 100], bpmDefault: 90, era: "1990s", characteristics: ["jazz samples", "live instrumentation", "lyrical", "sophisticated"], defaultNarrative: "conscious", defaultFlow: "melodic", defaultDelivery: "conversational", defaultProduction: "vintage", commonRhymeStyles: ["multi_syllabic", "internal", "free_form"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "verse", "outro"], vocalStyle: "smooth, articulate delivery with poetic lyricism", tags: ["jazz rap", "live instruments", "lyrical", "sophisticated"] },
  { id: "conscious_rap", label: "Conscious Rap", bpmRange: [80, 100], bpmDefault: 90, era: "1990s", characteristics: ["thought-provoking", "political", "social commentary", "lyrical"], defaultNarrative: "conscious", defaultFlow: "laid_back", defaultDelivery: "conversational", defaultProduction: "minimal", commonRhymeStyles: ["multi_syllabic", "internal", "free_form"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "verse", "outro"], vocalStyle: "clear, articulate delivery with emphatic phrasing", tags: ["conscious rap", "political", "social", "lyrical"] },
  { id: "alternative_hip_hop", label: "Alternative Hip Hop", bpmRange: [70, 110], bpmDefault: 90, era: "1990s", characteristics: ["experimental", "eclectic", "genre-blending", "creative"], defaultNarrative: "abstract", defaultFlow: "melodic", defaultDelivery: "conversational", defaultProduction: "experimental", commonRhymeStyles: ["free_form", "multi_syllabic", "internal"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "verse", "outro"], vocalStyle: "eclectic, experimental delivery with varied techniques", tags: ["alternative", "experimental", "eclectic", "genre-blending"] },
  { id: "cloud_rap", label: "Cloud Rap", bpmRange: [65, 95], bpmDefault: 74, era: "2010s", characteristics: ["ethereal", "dreamy", "atmospheric", "wistful"], defaultNarrative: "introspective", defaultFlow: "melodic", defaultDelivery: "calm", defaultProduction: "experimental", commonRhymeStyles: ["free_form", "end_rhyme", "internal"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "hook", "outro"], vocalStyle: "dreamy, ethereal delivery with reverb-drenched vocals", tags: ["cloud rap", "ethereal", "atmospheric", "dreamy"] },
  { id: "phonk", label: "Phonk", bpmRange: [60, 85], bpmDefault: 70, era: "2020s", characteristics: ["cowbell", "heavy bass", "vocal samples", "dark", "drift"], defaultNarrative: "braggadocio", defaultFlow: "laid_back", defaultDelivery: "intense", defaultProduction: "minimal", commonRhymeStyles: ["end_rhyme", "free_form"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "outro"], vocalStyle: "aggressive, chopped vocal samples with heavy bass", tags: ["phonk", "drift", "cowbell", "dark"] },
  { id: "uk_drill", label: "UK Drill", bpmRange: [135, 155], bpmDefault: 145, era: "2010s", characteristics: ["sliding 808s", "syncopated hi-hats", "dark", "raw", "uk slang"], defaultNarrative: "braggadocio", defaultFlow: "syncopated", defaultDelivery: "intense", defaultProduction: "minimal", commonRhymeStyles: ["end_rhyme", "multi_syllabic", "free_form"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "hook", "outro"], vocalStyle: "gritty, confrontational delivery with uk slang", tags: ["uk drill", "drill", "uk", "sliding 808s"] },
  { id: "grime", label: "Grime", bpmRange: [130, 145], bpmDefault: 140, era: "2000s", characteristics: ["skepta", "eskibeat", "synth leads", "aggressive", "uk"], defaultNarrative: "braggadocio", defaultFlow: "syncopated", defaultDelivery: "hype", defaultProduction: "electronic", commonRhymeStyles: ["multi_syllabic", "end_rhyme", "internal"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "hook", "outro"], vocalStyle: "rapid-fire, aggressive delivery with pirate radio influence", tags: ["grime", "uk", "eskibeat", "synth"] },
  { id: "afrobeats", label: "Afrobeats", bpmRange: [100, 120], bpmDefault: 108, era: "2010s", characteristics: ["african rhythms", "drum machine", "melodic", "danceable"], defaultNarrative: "party", defaultFlow: "melodic", defaultDelivery: "conversational", defaultProduction: "polished", commonRhymeStyles: ["end_rhyme", "multi_syllabic", "internal"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"], vocalStyle: "melodic, rhythmic delivery with african inflections", tags: ["afrobeats", "african", "dance", "melodic"] },
  { id: "trap_b", label: "Trap B (Trap&B)", bpmRange: [100, 140], bpmDefault: 130, era: "2020s", characteristics: ["trap beats", "r&b melodies", "singing", "smooth"], defaultNarrative: "storytelling", defaultFlow: "melodic", defaultDelivery: "conversational", defaultProduction: "polished", commonRhymeStyles: ["free_form", "end_rhyme", "internal"], typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"], vocalStyle: "smooth, melodic delivery blending rap and singing", tags: ["trap b", "r&b", "melodic", "singing"] },
];

// ── Helpers ───────────────────────────────────────────────────────────

export function getSubgenre(id: string, subgenres: HipHopSubgenreEntry[] = HIP_HOP_SUBGENRES): HipHopSubgenreEntry | undefined {
  return subgenres.find((s) => s.id === id);
}

export function getDefaultPreset(id: string, subgenres: HipHopSubgenreEntry[] = HIP_HOP_SUBGENRES): HipHopSubgenreEntry | undefined {
  return getSubgenre(id, subgenres) ?? subgenres[0];
}

export function getSubgenreEntryOrFallback(id: string, subgenres: HipHopSubgenreEntry[] = HIP_HOP_SUBGENRES): HipHopSubgenreEntry {
  return getSubgenre(id, subgenres) ?? subgenres[0]!;
}

export function getSubgenreOptions(subgenres: HipHopSubgenreEntry[] = HIP_HOP_SUBGENRES): { label: string; value: string }[] {
  return subgenres.map((s) => ({ label: s.label, value: s.id }));
}

export const NARRATIVE_ARC_OPTIONS: { label: string; value: NarrativeArc }[] = [
  { label: "Storytelling", value: "storytelling" },
  { label: "Braggadocio", value: "braggadocio" },
  { label: "Conscious", value: "conscious" },
  { label: "Party", value: "party" },
  { label: "Introspective", value: "introspective" },
  { label: "Abstract", value: "abstract" },
];

export const RHYME_STYLE_OPTIONS: { label: string; value: RhymeStyle }[] = [
  { label: "Multi-syllabic", value: "multi_syllabic" },
  { label: "End Rhyme", value: "end_rhyme" },
  { label: "Internal Rhyme", value: "internal" },
  { label: "Free Form", value: "free_form" },
  { label: "Slant Rhyme", value: "slant_rhyme" },
];

export const FLOW_PATTERN_OPTIONS: { label: string; value: FlowPattern }[] = [
  { label: "Laid-back", value: "laid_back" },
  { label: "Aggressive", value: "aggressive" },
  { label: "Syncopated", value: "syncopated" },
  { label: "Double Time", value: "double_time" },
  { label: "Melodic", value: "melodic" },
  { label: "Mumble", value: "mumble" },
];

export const DELIVERY_OPTIONS: { label: string; value: Delivery }[] = [
  { label: "Calm", value: "calm" },
  { label: "Intense", value: "intense" },
  { label: "Conversational", value: "conversational" },
  { label: "Hype", value: "hype" },
  { label: "Whispered", value: "whispered" },
];

export const PRODUCTION_STYLE_OPTIONS: {
  label: string;
  value: ProductionStyle;
}[] = [
  { label: "Lo-fi", value: "lo_fi" },
  { label: "Polished", value: "polished" },
  { label: "Vintage", value: "vintage" },
  { label: "Experimental", value: "experimental" },
  { label: "Minimal", value: "minimal" },
  { label: "Orchestral", value: "orchestral" },
  { label: "Electronic", value: "electronic" },
  { label: "Live Instruments", value: "live_instruments" },
];
