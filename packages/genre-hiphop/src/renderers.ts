import type { GenreRenderers } from "@track-forge/genre-core";
import type { HipHopBlueprint } from "./schema.js";
import { getSubgenre, type HipHopSubgenreEntry } from "./taxonomy.js";

const NARRATIVE_LABELS: Record<string, string> = {
  storytelling: "Storytelling narrative arc",
  braggadocio: "Braggadocio/competitive narrative",
  conscious: "Conscious/socially aware narrative",
  party: "Party/turn-up narrative",
  introspective: "Introspective/emotional narrative",
  abstract: "Abstract/experimental narrative",
};

const VERSE_THEMES: Record<string, string[]> = {
  storytelling: [
    "Let me take you back to the moment it all began",
    "Through the struggle and the pain, I found my way",
    "Every chapter of my life written in these streets",
    "The story unfolds with every breath I take",
  ],
  braggadocio: [
    "I'm the king of this game, there's no debate",
    "Crown on my head, they just watch and wait",
    "They said I couldn't, now look what I became",
    "Numbers don't lie, check the scoreboard again",
  ],
  conscious: [
    "System keeps us down, but we rise each day",
    "They build walls, we build bridges anyway",
    "Wake up, the revolution starts within",
    "Truth is the weapon, knowledge is the shield",
  ],
  party: [
    "Hands up high, feel the energy in the room",
    "Tonight we celebrate, forget the gloom",
    "The beat drops, bodies moving as one",
    "Turn up the volume, let the good times roll",
  ],
  introspective: [
    "Deep in my thoughts, the weight of the world",
    "I search for meaning in the quiet hours",
    "Every scar tells a story I'm learning to read",
    "The mirror shows a face I'm getting to know",
  ],
  abstract: [
    "Reality bends, perception is fluid",
    "Words paint pictures that logic can't frame",
    "Between the lines, a different frequency",
    "Abstract thoughts take physical form",
  ],
};

const HOOK_THEMES: Record<string, string[]> = {
  high: [
    "This is the moment, we own the night",
    "Can't stop, won't stop, we're taking flight",
  ],
  medium: [
    "You know the vibe, feel it in your soul",
    "Ride the wave, let the rhythm take control",
  ],
  low: [
    "Stay close, don't let the feeling fade",
    "In the silence, the truth is made",
  ],
};

const BRIDGE_THEMES: Record<string, string[]> = {
  storytelling: [
    "But everything changed when I looked back",
    "A different angle, a new truth revealed",
  ],
  braggadocio: [
    "They never thought I'd make it this far",
    "But here I stand, rewriting the narrative",
  ],
  conscious: [
    "We need to see beyond the surface",
    "The real change starts from within",
  ],
  party: [
    "But even the night must find its end",
    "Before the dawn, a moment to reflect",
  ],
  introspective: [
    "In the quiet between the noise",
    "I found a piece of myself I'd lost",
  ],
  abstract: [
    "The boundaries shift, reshape again",
    "What was solid dissolves into light",
  ],
};

function getVerseThemes(narrative: string, mood: string): string[] {
  const themes = VERSE_THEMES[narrative] ?? VERSE_THEMES.braggadocio!;
  const moodLine = mood ? `(${mood} vibe)` : "";
  return moodLine ? [themes[0]!, themes[1]!, moodLine, themes[3]!] : themes;
}

function getHookThemes(energy: number): string[] {
  if (energy >= 7) return HOOK_THEMES.high!;
  if (energy >= 4) return HOOK_THEMES.medium!;
  return HOOK_THEMES.low!;
}

function getBridgeThemes(narrative: string): string[] {
  return BRIDGE_THEMES[narrative] ?? BRIDGE_THEMES.introspective!;
}

const FLOW_LABELS: Record<string, string> = {
  laid_back: "laid-back",
  aggressive: "aggressive",
  syncopated: "syncopated",
  double_time: "double-time",
  melodic: "melodic",
  mumble: "mumble-style",
};

const DELIVERY_LABELS: Record<string, string> = {
  calm: "calm",
  intense: "intense",
  conversational: "conversational",
  hype: "hype",
  whispered: "whispered",
};

const PRODUCTION_LABELS: Record<string, string> = {
  lo_fi: "lo-fi",
  polished: "polished",
  vintage: "vintage/analog",
  experimental: "experimental",
  minimal: "minimal",
  orchestral: "orchestral/live strings",
  electronic: "electronic/synth-heavy",
  live_instruments: "live instrumentation",
};

function buildArrangementDescription(structure: string[], bpm: number): string {
  const sectionCount = structure.length;
  const estDuration = Math.round((sectionCount * 8 * 60) / bpm);
  return `Structure: ${structure.join(" → ")} (approx. ${estDuration}s @ ${bpm}BPM)`;
}

export function createHipHopRenderers(
  subgenreEntry?: HipHopSubgenreEntry,
): GenreRenderers<HipHopBlueprint> {
  return {
    title(data: HipHopBlueprint): string {
      const parts: string[] = [];
      if (data.mood) parts.push(data.mood);
      const subgenre = subgenreEntry ?? getSubgenre(data.subgenre);
      if (subgenre) parts.push(subgenre.label);
      parts.push(`(${data.key} ${data.scale})`);
      return parts.join(" ");
    },

    style(data: HipHopBlueprint): string {
      const subgenre = subgenreEntry ?? getSubgenre(data.subgenre);
      const lines: string[] = [];

      // Genre description
      if (subgenre) {
        lines.push(`Genre: ${subgenre.label} Hip-Hop`);
        lines.push(`Style: ${subgenre.description}`);
      }

      // Mood
      if (data.mood) {
        lines.push(`Mood: ${data.mood}`);
      }

      // BPM & Key
      lines.push(`Tempo: ${data.bpm}BPM | Key: ${data.key} ${data.scale}`);

      // Characteristics
      if (subgenre) {
        lines.push(`Characteristics: ${subgenre.characteristics.join(", ")}`);
      }

      // Narrative & Delivery
      lines.push(
        `Narrative: ${NARRATIVE_LABELS[data.narrativeArc!] ?? data.narrativeArc}`,
      );
      lines.push(`Flow: ${FLOW_LABELS[data.flowPattern!] ?? data.flowPattern}`);
      lines.push(
        `Delivery: ${DELIVERY_LABELS[data.delivery!] ?? data.delivery}`,
      );

      // Vocal style
      if (data.vocalStyle) {
        lines.push(`Vocal Style: ${data.vocalStyle}`);
      }

      // Production
      lines.push(
        `Production: ${PRODUCTION_LABELS[data.productionStyle!] ?? data.productionStyle}`,
      );
      lines.push(
        `Energy: ${data.energy}/10 | Lyrical Complexity: ${data.complexity}/10`,
      );

      // Tags
      const tags = [...data.tags];
      if (subgenre) tags.push(...subgenre.tags);
      if (tags.length > 0) {
        lines.push(`Tags: ${[...new Set(tags)].join(", ")}`);
      }

      return lines.join("\n");
    },

    excludedStyles(data: HipHopBlueprint): string {
      const exclusions: string[] = [];

      // Instrumental mode — exclude vocals
      if (data.lyricsMode === "instrumental") {
        exclusions.push("vocals", "singing", "lyrics", "voice");
      }

      // Opposite characteristics
      if (data.energy <= 4) exclusions.push("high-energy, aggressive, hype");
      else if (data.energy >= 8) exclusions.push("low-energy, slow, lethargic");

      if (data.complexity <= 3)
        exclusions.push("complex lyricism, dense wordplay");
      else if (data.complexity >= 8)
        exclusions.push("simple, repetitive, basic");

      if (data.scale === "major")
        exclusions.push("dark, melancholy, minor-key");
      else exclusions.push("bright, happy, major-key");

      // Flow-based
      if (data.flowPattern === "laid_back")
        exclusions.push("rapid-fire, double-time delivery");
      if (data.flowPattern === "aggressive")
        exclusions.push("relaxed, calm delivery");
      if (data.flowPattern === "melodic")
        exclusions.push("aggressive shouting");

      // Production-based
      if (
        data.productionStyle === "lo_fi" ||
        data.productionStyle === "vintage"
      ) {
        exclusions.push("polished, clean, modern production");
      }
      if (data.productionStyle === "polished") {
        exclusions.push("lo-fi, distorted, vintage sound");
      }

      // Narrative-based
      if (data.narrativeArc === "party")
        exclusions.push("dark, melancholic themes");
      if (
        data.narrativeArc === "conscious" ||
        data.narrativeArc === "introspective"
      ) {
        exclusions.push("mindless party lyrics");
      }

      if (data.negativeTags.length > 0) {
        exclusions.push(...data.negativeTags);
      }

      return exclusions.join(", ");
    },

    lyrics(data: HipHopBlueprint): string {
      if (data.lyricsMode === "instrumental") {
        return "";
      }

      const sections = data.songStructure;
      const lines: string[] = [];

      for (const section of sections) {
        switch (section) {
          case "intro":
            lines.push(`[Intro]`);
            lines.push(
              `(Build atmosphere — ${data.mood || "setting the mood"})`,
            );
            break;
          case "verse":
            lines.push(`[Verse]`);
            lines.push(`(${getVersePrompt(data)})`);
            for (const l of getVerseThemes(data.narrativeArc!, data.mood))
              lines.push(l);
            break;
          case "hook":
            lines.push(`[Hook]`);
            lines.push(`(${getHookPrompt(data)})`);
            for (const l of getHookThemes(data.energy)) lines.push(l);
            break;
          case "bridge":
            lines.push(`[Bridge]`);
            lines.push(`(Shift in perspective — ${getBridgePrompt(data)})`);
            for (const l of getBridgeThemes(data.narrativeArc!)) lines.push(l);
            break;
          case "break":
            lines.push(`[Break]`);
            lines.push(`(Instrumental break — production focus)`);
            break;
          case "solo":
            lines.push(`[Solo / Spoken Word]`);
            lines.push(`(Instrumental showcase or spoken word passage)`);
            break;
          case "outro":
            lines.push(`[Outro]`);
            lines.push(`(Fade out — ${data.mood || "concluding the track"})`);
            break;
        }
      }

      return lines.join("\n");
    },
  };
}

function getVersePrompt(data: HipHopBlueprint): string {
  const parts: string[] = [];
  parts.push(`${NARRATIVE_LABELS[data.narrativeArc!] ?? data.narrativeArc}`);
  parts.push(`${FLOW_LABELS[data.flowPattern!] ?? data.flowPattern} flow`);
  return parts.join(", ");
}

function getHookPrompt(data: HipHopBlueprint): string {
  const parts: string[] = [];
  parts.push(`memorable, catchy hook`);
  parts.push(`${DELIVERY_LABELS[data.delivery!] ?? data.delivery} delivery`);
  if (data.energy >= 7) parts.push("high energy");
  return parts.join(", ");
}

function getBridgePrompt(data: HipHopBlueprint): string {
  const parts: string[] = [];
  parts.push(`narrative progression`);
  if (data.flowPattern === "melodic") parts.push("melodic shift");
  return parts.join(", ");
}
