// ── Hip-Hop subgenre taxonomy ─────────────────────────────────────────

export type NarrativeArc =
  | "storytelling"
  | "braggadocio"
  | "conscious"
  | "party"
  | "introspective"
  | "abstract";

export type RhymeStyle =
  | "multi_syllabic"
  | "end_rhyme"
  | "internal"
  | "free_form"
  | "slant_rhyme";

export type FlowPattern =
  | "laid_back"
  | "aggressive"
  | "syncopated"
  | "double_time"
  | "melodic"
  | "mumble";

export type Delivery =
  | "calm"
  | "intense"
  | "conversational"
  | "hype"
  | "whispered";

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
  description: string;
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

export const HIP_HOP_SUBGENRES: HipHopSubgenreEntry[] = [
  {
    id: "boom_bap",
    label: "Boom Bap",
    description: "Hard-hitting drums with prominent kick and snare, sampled loops, gritty aesthetic",
    bpmRange: [85, 95],
    bpmDefault: 90,
    era: "1990s",
    characteristics: ["hard drums", "sampled loops", "gritty", "raw", "head-nod groove"],
    defaultNarrative: "braggadocio",
    defaultFlow: "laid_back",
    defaultDelivery: "intense",
    defaultProduction: "vintage",
    commonRhymeStyles: ["multi_syllabic", "end_rhyme", "internal"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "verse", "outro"],
    vocalStyle: "assertive, commanding delivery with precise phrasing",
    tags: ["boom bap", "east coast", "90s hip hop", "sampled"],
  },
  {
    id: "trap",
    label: "Trap",
    description: "Rolling hi-hats, 808 bass, syncopated snare, dark atmospheres",
    bpmRange: [130, 170],
    bpmDefault: 150,
    era: "2010s",
    characteristics: ["808 bass", "rolling hi-hats", "dark", "synth-heavy", "snare rolls"],
    defaultNarrative: "braggadocio",
    defaultFlow: "syncopated",
    defaultDelivery: "hype",
    defaultProduction: "polished",
    commonRhymeStyles: ["multi_syllabic", "end_rhyme", "free_form"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"],
    vocalStyle: "rhythmic, triplet flows with ad-libs and melodic hooks",
    tags: ["trap", "808", "hi-hats", "southern hip hop"],
  },
  {
    id: "drill",
    label: "Drill",
    description: "Minimalist beats, sliding 808s, aggressive delivery, dark energy",
    bpmRange: [130, 160],
    bpmDefault: 145,
    era: "2010s",
    characteristics: ["sliding 808s", "minimal percussion", "aggressive", "dark", "raw"],
    defaultNarrative: "braggadocio",
    defaultFlow: "aggressive",
    defaultDelivery: "intense",
    defaultProduction: "minimal",
    commonRhymeStyles: ["end_rhyme", "multi_syllabic", "free_form"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "outro"],
    vocalStyle: "gritty, confrontational delivery with distinct cadence",
    tags: ["drill", "raw", "aggressive", "chicago drill", "uk drill"],
  },
  {
    id: "old_school",
    label: "Old School",
    description: "Classic breakbeats, funky basslines, party-focused, call-and-response",
    bpmRange: [90, 110],
    bpmDefault: 100,
    era: "1980s",
    characteristics: ["breakbeats", "funky", "party vibe", "scratching", "call-and-response"],
    defaultNarrative: "party",
    defaultFlow: "laid_back",
    defaultDelivery: "conversational",
    defaultProduction: "vintage",
    commonRhymeStyles: ["end_rhyme", "internal", "slant_rhyme"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "break", "verse", "outro"],
    vocalStyle: "playful, energetic delivery with crowd engagement",
    tags: ["old school", "breakbeats", "party rap", "80s hip hop"],
  },
  {
    id: "gangsta_rap",
    label: "Gangsta Rap",
    description: "Street narratives, heavy bass, cinematic samples, raw storytelling",
    bpmRange: [80, 100],
    bpmDefault: 90,
    era: "1990s",
    characteristics: ["heavy bass", "cinematic samples", "storytelling", "raw", "street narratives"],
    defaultNarrative: "storytelling",
    defaultFlow: "laid_back",
    defaultDelivery: "intense",
    defaultProduction: "vintage",
    commonRhymeStyles: ["multi_syllabic", "end_rhyme", "internal"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "hook", "outro"],
    vocalStyle: "authoritative, narrative delivery with vivid imagery",
    tags: ["gangsta rap", "west coast", "storytelling", "street"],
  },
  {
    id: "g_funk",
    label: "G-Funk",
    description: "Synthesized P-funk samples, smooth grooves, whiny synths, laid-back flow",
    bpmRange: [90, 100],
    bpmDefault: 95,
    era: "1990s",
    characteristics: ["p-funk samples", "smooth grooves", "whiny synths", "laid-back", "melodic"],
    defaultNarrative: "braggadocio",
    defaultFlow: "laid_back",
    defaultDelivery: "conversational",
    defaultProduction: "vintage",
    commonRhymeStyles: ["end_rhyme", "internal", "multi_syllabic"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "hook", "outro"],
    vocalStyle: "smooth, melodic delivery with sung hooks",
    tags: ["g-funk", "west coast", "p-funk", "smooth"],
  },
  {
    id: "east_coast",
    label: "East Coast",
    description: "Complex lyricism, dense wordplay, jazzy samples, boom bap foundation",
    bpmRange: [85, 100],
    bpmDefault: 92,
    era: "1990s",
    characteristics: ["complex lyricism", "dense wordplay", "jazzy samples", "boom bap", "lyrical"],
    defaultNarrative: "conscious",
    defaultFlow: "syncopated",
    defaultDelivery: "intense",
    defaultProduction: "vintage",
    commonRhymeStyles: ["multi_syllabic", "internal", "slant_rhyme"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "hook", "outro"],
    vocalStyle: "lyrical, technical delivery with complex rhyme schemes",
    tags: ["east coast", "lyrical", "boom bap", "complex"],
  },
  {
    id: "southern_hip_hop",
    label: "Southern Hip-Hop",
    description: "Slow heavy beats, trunk-rattling bass, chopped-and-screwed influence",
    bpmRange: [70, 85],
    bpmDefault: 78,
    era: "2000s",
    characteristics: ["heavy bass", "slow beats", "chopped and screwed", "trunk-rattling", "syrupy"],
    defaultNarrative: "braggadocio",
    defaultFlow: "laid_back",
    defaultDelivery: "conversational",
    defaultProduction: "polished",
    commonRhymeStyles: ["end_rhyme", "multi_syllabic", "free_form"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "hook", "outro"],
    vocalStyle: "slow, drawn-out delivery with southern drawl",
    tags: ["southern", "chopped and screwed", "slow", "bass"],
  },
  {
    id: "crunk",
    label: "Crunk",
    description: "High-energy party anthems, repetitive call-outs, heavy bass, aggressive",
    bpmRange: [70, 90],
    bpmDefault: 80,
    era: "2000s",
    characteristics: ["high-energy", "party", "call-outs", "heavy bass", "repetitive hooks"],
    defaultNarrative: "party",
    defaultFlow: "aggressive",
    defaultDelivery: "hype",
    defaultProduction: "polished",
    commonRhymeStyles: ["end_rhyme", "free_form"],
    typicalSongStructure: ["intro", "hook", "verse", "hook", "verse", "hook", "break", "hook"],
    vocalStyle: "loud, energetic shouting delivery with call-and-response",
    tags: ["crunk", "party", "southern", "high-energy"],
  },
  {
    id: "hyphy",
    label: "Hyphy",
    description: "Upbeat, frenetic energy, synth stabs, heavy kick, dance-oriented",
    bpmRange: [90, 115],
    bpmDefault: 105,
    era: "2000s",
    characteristics: ["frenetic", "upbeat", "synth stabs", "dance", "bay area"],
    defaultNarrative: "party",
    defaultFlow: "syncopated",
    defaultDelivery: "hype",
    defaultProduction: "polished",
    commonRhymeStyles: ["end_rhyme", "multi_syllabic"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "break", "hook", "outro"],
    vocalStyle: "energetic, rapid-fire delivery with ad-libs",
    tags: ["hyphy", "bay area", "party", "dance"],
  },
  {
    id: "mumble_rap",
    label: "Mumble Rap",
    description: "Melodic, slurred delivery, trap-influenced beats, vibe over lyrics",
    bpmRange: [130, 170],
    bpmDefault: 150,
    era: "2010s",
    characteristics: ["melodic", "slurred delivery", "trap beats", "vibe-focused", "ad-libs"],
    defaultNarrative: "braggadocio",
    defaultFlow: "mumble",
    defaultDelivery: "calm",
    defaultProduction: "polished",
    commonRhymeStyles: ["end_rhyme", "free_form", "slant_rhyme"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"],
    vocalStyle: "melodic, slurred delivery with heavy auto-tune and ad-libs",
    tags: ["mumble rap", "melodic", "trap", "auto-tune"],
  },
  {
    id: "emo_rap",
    label: "Emo Rap",
    description: "Emotional lyrics, rock influences, melodic delivery, introspective themes",
    bpmRange: [140, 180],
    bpmDefault: 160,
    era: "2010s",
    characteristics: ["emotional", "rock-influenced", "melodic", "introspective", "guitar samples"],
    defaultNarrative: "introspective",
    defaultFlow: "melodic",
    defaultDelivery: "conversational",
    defaultProduction: "polished",
    commonRhymeStyles: ["end_rhyme", "multi_syllabic", "slant_rhyme"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"],
    vocalStyle: "emotional, melodic delivery with sung choruses",
    tags: ["emo rap", "melodic", "emotional", "rock-influenced"],
  },
  {
    id: "lo_fi_hip_hop",
    label: "Lo-fi Hip-Hop",
    description: "Chill, relaxed beats, vinyl crackle, jazz samples, study music aesthetic",
    bpmRange: [70, 90],
    bpmDefault: 80,
    era: "2010s",
    characteristics: ["chill", "jazz samples", "vinyl crackle", "relaxed", "mellow"],
    defaultNarrative: "introspective",
    defaultFlow: "laid_back",
    defaultDelivery: "calm",
    defaultProduction: "lo_fi",
    commonRhymeStyles: ["multi_syllabic", "internal", "slant_rhyme"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "outro"],
    vocalStyle: "gentle, relaxed delivery with smooth flow",
    tags: ["lo-fi", "chill", "jazz hop", "study beats"],
  },
  {
    id: "jazz_rap",
    label: "Jazz Rap",
    description: "Live jazz instrumentation, complex harmonies, sophisticated lyricism",
    bpmRange: [80, 105],
    bpmDefault: 92,
    era: "1990s",
    characteristics: ["jazz instrumentation", "complex harmonies", "sophisticated", "live instruments", "intellectual"],
    defaultNarrative: "conscious",
    defaultFlow: "syncopated",
    defaultDelivery: "conversational",
    defaultProduction: "live_instruments",
    commonRhymeStyles: ["multi_syllabic", "internal", "slant_rhyme", "free_form"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "solo", "verse", "outro"],
    vocalStyle: "intelligent, smooth delivery with sophisticated wordplay",
    tags: ["jazz rap", "live instruments", "sophisticated", "conscious"],
  },
  {
    id: "conscious_rap",
    label: "Conscious Rap",
    description: "Socially aware lyrics, political themes, intellectual content, message-driven",
    bpmRange: [85, 100],
    bpmDefault: 92,
    era: "1990s",
    characteristics: ["socially aware", "political", "intellectual", "message-driven", "thought-provoking"],
    defaultNarrative: "conscious",
    defaultFlow: "laid_back",
    defaultDelivery: "conversational",
    defaultProduction: "minimal",
    commonRhymeStyles: ["multi_syllabic", "internal", "slant_rhyme"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "hook", "outro"],
    vocalStyle: "thoughtful, articulate delivery with emphasis on message",
    tags: ["conscious", "political", "social commentary", "intellectual"],
  },
  {
    id: "alternative_hip_hop",
    label: "Alternative Hip-Hop",
    description: "Eclectic influences, experimental production, non-traditional song structures",
    bpmRange: [80, 110],
    bpmDefault: 95,
    era: "1990s",
    characteristics: ["eclectic", "experimental", "non-traditional", "genre-blending", "artistic"],
    defaultNarrative: "abstract",
    defaultFlow: "syncopated",
    defaultDelivery: "conversational",
    defaultProduction: "experimental",
    commonRhymeStyles: ["multi_syllabic", "free_form", "internal", "slant_rhyme"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "bridge", "verse", "outro"],
    vocalStyle: "creative, unconventional delivery with artistic expression",
    tags: ["alternative", "experimental", "eclectic", "artistic"],
  },
  {
    id: "cloud_rap",
    label: "Cloud Rap",
    description: "Ethereal, dreamy beats, atmospheric production, laid-back delivery",
    bpmRange: [60, 90],
    bpmDefault: 75,
    era: "2010s",
    characteristics: ["ethereal", "dreamy", "atmospheric", "laid-back", "reverberant"],
    defaultNarrative: "abstract",
    defaultFlow: "laid_back",
    defaultDelivery: "calm",
    defaultProduction: "experimental",
    commonRhymeStyles: ["free_form", "slant_rhyme", "multi_syllabic"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "outro"],
    vocalStyle: "ethereal, echoey delivery with atmospheric effects",
    tags: ["cloud rap", "ethereal", "atmospheric", "dreamy"],
  },
  {
    id: "phonk",
    label: "Phonk",
    description: "Cowbell-driven, Memphis rap influence, chopped vocals, lo-fi aesthetic",
    bpmRange: [60, 90],
    bpmDefault: 75,
    era: "2010s",
    characteristics: ["cowbells", "memphis influence", "chopped vocals", "lo-fi", "dark"],
    defaultNarrative: "braggadocio",
    defaultFlow: "laid_back",
    defaultDelivery: "intense",
    defaultProduction: "lo_fi",
    commonRhymeStyles: ["end_rhyme", "free_form"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "outro"],
    vocalStyle: "chopped, distorted delivery with lo-fi texture",
    tags: ["phonk", "memphis", "cowbell", "lo-fi", "dark"],
  },
  {
    id: "uk_drill",
    label: "UK Drill",
    description: "Slidey 808s, sparse beats, off-beat hi-hats, aggressive UK slang",
    bpmRange: [135, 155],
    bpmDefault: 145,
    era: "2010s",
    characteristics: ["slidey 808s", "sparse", "off-beat hi-hats", "aggressive", "uk slang"],
    defaultNarrative: "braggadocio",
    defaultFlow: "aggressive",
    defaultDelivery: "intense",
    defaultProduction: "minimal",
    commonRhymeStyles: ["end_rhyme", "multi_syllabic", "free_form"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "outro"],
    vocalStyle: "gritty, rapid delivery with UK street slang and distinct rhythm",
    tags: ["uk drill", "slidey 808s", "uk hip hop", "road rap"],
  },
  {
    id: "grime",
    label: "Grime",
    description: "140BPM breakneck beats, synth stabs, UK garage influence, energetic flow",
    bpmRange: [135, 145],
    bpmDefault: 140,
    era: "2000s",
    characteristics: ["breakneck", "synth stabs", "uk garage", "energetic", "rewinds"],
    defaultNarrative: "braggadocio",
    defaultFlow: "double_time",
    defaultDelivery: "intense",
    defaultProduction: "electronic",
    commonRhymeStyles: ["multi_syllabic", "end_rhyme", "internal"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "verse", "hook", "outro"],
    vocalStyle: "rapid-fire, aggressive delivery with UK accent and energy",
    tags: ["grime", "uk garage", "140", "synth", "uk rap"],
  },
  {
    id: "afrobeats",
    label: "Afrobeats",
    description: "African percussion, rhythmic guitar, call-and-response, dance-friendly",
    bpmRange: [100, 125],
    bpmDefault: 112,
    era: "2010s",
    characteristics: ["african percussion", "rhythmic", "dance", "call-and-response", "sunny"],
    defaultNarrative: "party",
    defaultFlow: "melodic",
    defaultDelivery: "conversational",
    defaultProduction: "polished",
    commonRhymeStyles: ["end_rhyme", "multi_syllabic"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"],
    vocalStyle: "melodic, rhythmic delivery with sung hooks and African cadence",
    tags: ["afrobeats", "african", "dance", "percussion"],
  },
  {
    id: "trap_b",
    label: "Trap&B",
    description: "Trap beats with R&B melodies, sung verses, hybrid rap-sung delivery",
    bpmRange: [110, 150],
    bpmDefault: 130,
    era: "2010s",
    characteristics: ["trap beats", "r&b melodies", "rap-sung", "romantic", "smooth"],
    defaultNarrative: "introspective",
    defaultFlow: "melodic",
    defaultDelivery: "conversational",
    defaultProduction: "polished",
    commonRhymeStyles: ["multi_syllabic", "end_rhyme", "slant_rhyme"],
    typicalSongStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"],
    vocalStyle: "melodic rap-sung delivery with smooth transitions between rap and singing",
    tags: ["trap & b", "r&b", "melodic", "romantic"],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────

export function getSubgenre(id: string): HipHopSubgenreEntry | undefined {
  return HIP_HOP_SUBGENRES.find((s) => s.id === id);
}

export function getDefaultPreset(id: string): HipHopSubgenreEntry | undefined {
  return getSubgenre(id) ?? HIP_HOP_SUBGENRES[0];
}

export function getSubgenreEntryOrFallback(id: string): HipHopSubgenreEntry {
  return getSubgenre(id) ?? HIP_HOP_SUBGENRES[0]!;
}

export function getSubgenreOptions(): { label: string; value: string }[] {
  return HIP_HOP_SUBGENRES.map((s) => ({ label: s.label, value: s.id }));
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

export const PRODUCTION_STYLE_OPTIONS: { label: string; value: ProductionStyle }[] = [
  { label: "Lo-fi", value: "lo_fi" },
  { label: "Polished", value: "polished" },
  { label: "Vintage", value: "vintage" },
  { label: "Experimental", value: "experimental" },
  { label: "Minimal", value: "minimal" },
  { label: "Orchestral", value: "orchestral" },
  { label: "Electronic", value: "electronic" },
  { label: "Live Instruments", value: "live_instruments" },
];
