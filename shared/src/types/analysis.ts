import { NormalizedMidiData } from './midi';
import { PerformanceEvent, PerformanceAnalysisResult } from './performance';

/**
 * THE ML BOUNDARY
 * ----------------
 * Everything downstream of a captured performance goes through this
 * interface. The server's default implementation is rule-based
 * (see server/src/services/scoring/RuleBasedScoringEngine.ts).
 *
 * A future MLScoringEngine implementation can call out to an external
 * Python/FastAPI service, but MUST still return a PerformanceAnalysisResult
 * — the frontend and database schema never need to change when the
 * scoring implementation changes. Only PerformanceService's choice of
 * `ScoringEngine` implementation changes (a one-line swap / DI config).
 */

/** Extracted, model-agnostic numeric features from a raw performance. */
export interface PerformanceFeatureVector {
  noteCount: number;
  correctNoteRatio: number;
  averageTimingDeviationMs: number;
  timingDeviationStdDevMs: number;
  averageDurationDeviationBeats: number;
  averageVelocityDeviation: number;
  missedNoteRatio: number;
  extraNoteRatio: number;
  wrongPitchRatio: number;
  perBarErrorCounts: Record<number, number>;
}

export interface PerformanceAnalyzer {
  /** Turns raw reference + captured events into a model-agnostic feature vector. */
  extractFeatures(
    reference: NormalizedMidiData,
    startBar: number,
    endBar: number,
    events: PerformanceEvent[],
    tempoBpm: number
  ): PerformanceFeatureVector;
}

export interface ScoringEngine {
  readonly name: string; // e.g. "rule-based-v1" or "ml-v1"
  score(
    reference: NormalizedMidiData,
    startBar: number,
    endBar: number,
    events: PerformanceEvent[],
    tempoBpm: number
  ): Promise<PerformanceAnalysisResult> | PerformanceAnalysisResult;
}

/**
 * Marker interface — implementations of this call an external ML
 * service (HTTP) instead of computing everything in-process. Declaring
 * it separately makes the future integration point explicit and
 * discoverable in the codebase without committing to Python now.
 */
export interface MLScoringEngine extends ScoringEngine {
  readonly endpoint: string;
}
