/**
 * PERFORMANCE TYPES
 * -----------------
 * These describe what actually gets captured while a user plays
 * (raw events), and the structured, explainable analysis produced by
 * diffing those events against a SongVersion's NormalizedMidiData.
 *
 * Nothing here is UI-specific — these types are the contract between
 * the Test/Learning Engines (browser), the persistence API (server),
 * and, eventually, the ML scoring service.
 */

export type PerformanceMode = 'learn' | 'test';

export type PerformanceEventType = 'noteOn' | 'noteOff';

/**
 * One captured note event from the user's physical keyboard during a
 * learn/test session. This is the raw, ML-research-grade unit of data —
 * we never collapse this into just a score.
 */
export interface PerformanceEvent {
  type: PerformanceEventType;
  note: number; // MIDI 0-127
  velocity: number;
  channel: number;
  /** ms, relative to the performance's t=0 (count-in end / recording start) */
  timestamp: number;
  /** ms, only present on noteOff */
  duration?: number;
  /** Bar/beat this event was matched against, filled in during analysis */
  bar?: number;
  beat?: number;
}

export interface PerformanceConfig {
  songId: string;
  songVersionId: string;
  mode: PerformanceMode;
  startBar: number;
  endBar: number;
  tempoBpm: number; // may differ from original for slow practice
  metronomeEnabled: boolean;
  countInBars: 0 | 1 | 2;
  hands: 'both' | 'left' | 'right';
}

export type MistakeType =
  | 'wrong_pitch'
  | 'missed_note'
  | 'extra_note'
  | 'early'
  | 'late'
  | 'duration_short'
  | 'duration_long'
  | 'velocity_soft'
  | 'velocity_hard';

export interface Mistake {
  bar: number;
  beat: number;
  type: MistakeType;
  expectedNote?: string;
  actualNote?: string;
  expectedDuration?: number; // beats
  actualDuration?: number; // beats
  expectedTimingMs?: number;
  actualTimingMs?: number;
  deviationMs?: number;
  expectedVelocity?: number;
  actualVelocity?: number;
  message: string; // human-readable, e.g. "Expected E5, but you played F5."
}

export interface DimensionScore {
  /** 0-100, transparent & explainable, never the only output of a dimension */
  score: number;
  label: string; // e.g. "Good", "Needs work"
  detail: string; // e.g. "91% correct", "Average deviation 85ms"
}

export interface BarHeatmapEntry {
  bar: number;
  status: 'good' | 'needs_practice' | 'difficult' | 'not_attempted';
  mistakeCount: number;
}

/**
 * The full explainable output of comparing a performance against the
 * reference. This is what both the rule-based ScoringEngine and any
 * future MLScoringEngine must produce — see analysis.ts for the
 * interfaces that enforce this contract.
 */
export interface PerformanceAnalysisResult {
  summary: {
    notesExpected: number;
    notesCorrect: number;
    notesMissed: number;
    notesExtra: number;
    notesWrongPitch: number;
    notesEarly: number;
    notesLate: number;
    averageTimingDeviationMs: number;
    averageDurationDeviationBeats: number;
  };
  dimensions: {
    noteAccuracy: DimensionScore;
    timing: DimensionScore;
    duration: DimensionScore;
    rhythm: DimensionScore;
    dynamics: DimensionScore;
  };
  mistakes: Mistake[];
  barHeatmap: BarHeatmapEntry[];
  narrative: string[]; // e.g. ["Most errors occurred in bars 6-8.", ...]
  /** which engine produced this — lets the UI/DB stay agnostic to rule-based vs ML */
  generatedBy: 'rule-based-v1' | string;
}

export interface PracticeSessionSummary {
  totalDurationSeconds: number;
  songsPracticed: number;
  barsCompleted: number;
}
