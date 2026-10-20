import { NormalizedMidiData } from './midi';

export type SongCategory = 'open_library' | 'trinity_gradebook' | 'my_library';

export type DifficultyLevel = 'beginner' | 'early_intermediate' | 'intermediate' | 'advanced' | 'expert';

export interface TrinityGradebookInfo {
  grade: number; // 1-8
  syllabusYear?: string;
  list?: 'A' | 'B' | 'C' | string;
}

/**
 * Song = the conceptual piece ("Für Elise" by Beethoven).
 * A Song can have multiple SongVersions (different arrangements,
 * different source MIDI files, different difficulty edits) — this is
 * what lets a teacher later assign a simplified version without forking
 * the whole catalog entry.
 */
export interface Song {
  id: string;
  title: string;
  composer: string;
  category: SongCategory;
  difficulty: DifficultyLevel;
  genre?: string;
  description?: string;
  trinity?: TrinityGradebookInfo;
  defaultVersionId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * A concrete playable/learnable rendition of a Song, backed by exactly
 * one ingested MIDI file. Keeping this separate from Song lets us store
 * multiple MIDI sources per piece and swap the "default" one without
 * losing performance history tied to a specific version.
 */
export interface SongVersion {
  id: string;
  songId: string;
  label: string; // e.g. "Original", "Simplified LH"
  sourceFilePath: string; // relative path under /data/midi
  originalTempoBpm: number;
  midiDataId: string; // ref to MIDIData document (the heavy parsed payload)
  createdAt: string;
}
