// ── EDM subgenre taxonomy ─────────────────────────────────────────────

export const EdmFamily = [
  "house",
  "techno",
  "trance",
  "breakbeat",
  "dnb",
  "bass",
  "hardcore",
  "electro",
  "downtempo",
  "pop",
] as const;
export type EdmFamily = (typeof EdmFamily)[number];

const familyLabels: Record<EdmFamily, string> = {
  house: "House",
  techno: "Techno",
  trance: "Trance",
  breakbeat: "Breakbeat / Breaks",
  dnb: "Drum & Bass",
  bass: "Bass Music",
  hardcore: "Hardcore / Hardstyle",
  electro: "Electro",
  downtempo: "Downtempo / Chill",
  pop: "Pop / Dance",
};

export type VocalMode = "none" | "vocals_hook" | "vocals_full";

export interface EdmSubgenreEntry {
  id: string;
  label: string;
  family: EdmFamily;
  bpmRange: [number, number];
  bpmDefault: number;
  scale: "major" | "minor";
  characteristics: string[];
  vocalMode: VocalMode;
  arrangementTags: Record<string, string[]>;
  description?: string;
}

/**
 * Minimal fallback for static init — full data is in YAML taxonomy (43 entries).
 * Validators and form dropdowns read this static array, NOT the augmented YAML,
 * so shrinking to 1 entry means users can only select Deep House.
 * Fix: refactor validators/schema pipeline to consume runtime-augmented taxonomy.
 */
export const EDM_SUBGENRES: EdmSubgenreEntry[] = [
  { id: "deep_house", label: "Deep House", family: "house", bpmRange: [110, 125], bpmDefault: 120, scale: "minor", characteristics: ["warm", "soulful"], vocalMode: "vocals_hook", arrangementTags: {}, description: "Warm, soulful house" },
];

// ── Helpers ───────────────────────────────────────────────────────────

export function getSubgenre(id: string, subgenres: EdmSubgenreEntry[] = EDM_SUBGENRES): EdmSubgenreEntry | undefined {
  return subgenres.find((s) => s.id === id);
}

export function getSubgenresByFamily(family: EdmFamily, subgenres: EdmSubgenreEntry[] = EDM_SUBGENRES): EdmSubgenreEntry[] {
  return subgenres.filter((s) => s.family === family);
}

export function getFamilyLabel(family: EdmFamily): string {
  return familyLabels[family];
}

export function getAllFamilyOptions(): { label: string; value: EdmFamily }[] {
  return EdmFamily.map((f) => ({ label: familyLabels[f], value: f }));
}

export function getSubgenreOptions(
  family: EdmFamily,
  subgenres: EdmSubgenreEntry[] = EDM_SUBGENRES,
): { label: string; value: string }[] {
  return getSubgenresByFamily(family, subgenres).map((s) => ({
    label: s.label,
    value: s.id,
  }));
}
