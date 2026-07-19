export type DescriptorCategory =
  "sound" | "rhythm" | "atmosphere" | "production" | "energy";

export type DescriptorWeight = 1 | 2 | 3;

export interface Descriptor {
  id: string;
  label: string;
  cat: DescriptorCategory;
  weight: DescriptorWeight;
  muted: boolean;
}

export type SectionFunction =
  | "establish"
  | "introduce"
  | "escalate"
  | "contrast"
  | "remove"
  | "peak"
  | "resolve";

export interface Vocal {
  type: string;
  delivery: string;
  energy: number;
  adlibs: boolean;
  harmonies: boolean;
}

export interface Section {
  id: string;
  name: string;
  bars: number;
  fn: SectionFunction;
  deltas: string[];
  vocal?: Vocal;
}

export type LyricsMode =
  "full_lyrics" | "strict_instrumental" | "guided_instrumental";

export type LyricAngle = "first_person" | "story" | "abstract" | "anthemic";

export type ArrangeSource = "default" | "custom";

export type SetupCardId =
  "genre" | "preset" | "tempo" | "lyrics" | "descriptors" | "reference";

export interface SetupCardsOpen {
  genre: boolean;
  preset: boolean;
  tempo: boolean;
  lyrics: boolean;
  descriptors: boolean;
  reference: boolean;
}

export interface Take {
  id: string;
  title: string;
  meta: string;
  fav: boolean;
  playing: boolean;
}
