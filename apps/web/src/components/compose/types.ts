import type { LyricsFormat } from "@track-forge/contracts";
import type {
  DescriptorCategory,
  DescriptorWeight,
  SectionFunction,
  SongStructureSection,
  SongStructureBarSpec,
  Vocal,
} from "@track-forge/genre-core";

export type {
  DescriptorCategory,
  DescriptorWeight,
  SectionFunction,
  SongStructureSection,
  SongStructureBarSpec,
  Vocal,
};

export interface Descriptor {
  id: string;
  label: string;
  cat: DescriptorCategory;
  weight: DescriptorWeight;
  muted: boolean;
}

export interface Section {
  id: string;
  name: string;
  bars: number;
  fn: SectionFunction;
  deltas: string[];
  vocal?: Vocal;
}

export type LyricsMode = LyricsFormat;

export type LyricAngle = "first_person" | "story" | "abstract" | "anthemic";

export type ArrangeSource = "default" | "custom";

export type SetupCardId = "sound" | "descriptors" | "reference";

export interface SetupCardsOpen {
  sound: boolean;
  descriptors: boolean;
  reference: boolean;
}

export interface TakeTrack {
  id: string;
  index: number;
  audioUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  duration?: number;
  title?: string;
}

export interface Take {
  id: string;
  jobId?: string;
  versionId?: string;
  status: string;
  audioUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  duration?: number;
  generatedTitle?: string;
  style?: string;
  error?: string;
  isFavorite?: boolean;
  createdAt?: string;
  updatedAt?: string;
  tracks?: TakeTrack[];
}
