import {
  NormalizedMidiData,
  NormalizedNote,
  PerformanceEvent,
  PerformanceAnalysisResult,
  Mistake,
  ScoringEngine,
  DimensionScore,
  BarHeatmapEntry,
} from '@maestro/shared';

interface MatchedPair {
  reference: NormalizedNote;
  actual: { note: number; startMs: number; durationMs: number; velocity: number } | null;
}

// Tolerances — tunable, but centralized here rather than scattered through
// the codebase, and each has a musical justification.
const TIMING_TOLERANCE_MS = 120; // within this, a note counts as "on time"
const EARLY_LATE_THRESHOLD_MS = 60; // beyond tolerance, classify as early/late for narrative
const DURATION_TOLERANCE_BEATS = 0.25; // quarter-beat leeway on note length
const VELOCITY_TOLERANCE = 20; // out of 127

export class RuleBasedScoringEngine implements ScoringEngine {
  readonly name = 'rule-based-v1';

  score(
    reference: NormalizedMidiData,
    startBar: number,
    endBar: number,
    events: PerformanceEvent[],
    tempoBpm: number
  ): PerformanceAnalysisResult {
    const referenceNotes = reference.notes
      .filter((n) => n.bar >= startBar && n.bar <= endBar)
      .sort((a, b) => a.startTick - b.startTick);

    const tempoRatio = tempoBpm / this.originalBpm(reference);
    const secondsPerBeatAtSessionTempo = 60 / tempoBpm;

    // Reconstruct note-on/note-off pairs from the flat event stream.
    const actualNotes = this.pairEvents(events);

    const { pairs, extraNotes } = this.matchNotes(referenceNotes, actualNotes, tempoRatio, reference);

    const mistakes: Mistake[] = [];
    let correct = 0;
    let missed = 0;
    let wrongPitch = 0;
    let early = 0;
    let late = 0;
    const timingDeviations: number[] = [];
    const durationDeviations: number[] = [];
    const velocityDeviations: number[] = [];
    const perBarMistakeCount: Record<number, number> = {};

    for (const pair of pairs) {
      const ref = pair.reference;
      const expectedTimeMs = ref.startTime * 1000; // reference file's own time; comparison uses scaled actual clock (see matchNotes)

      if (!pair.actual) {
        missed++;
        perBarMistakeCount[ref.bar] = (perBarMistakeCount[ref.bar] ?? 0) + 1;
        mistakes.push({
          bar: ref.bar,
          beat: ref.beat,
          type: 'missed_note',
          expectedNote: ref.name,
          message: `Missed note ${ref.name} in bar ${ref.bar}.`,
        });
        continue;
      }

      const deviationMs = pair.actual.startMs - expectedTimeMs * tempoRatio;
      timingDeviations.push(deviationMs);

      if (pair.actual.note !== ref.midi) {
        wrongPitch++;
        perBarMistakeCount[ref.bar] = (perBarMistakeCount[ref.bar] ?? 0) + 1;
        mistakes.push({
          bar: ref.bar,
          beat: ref.beat,
          type: 'wrong_pitch',
          expectedNote: ref.name,
          actualNote: this.midiToName(pair.actual.note),
          message: `Expected ${ref.name}, but you played ${this.midiToName(pair.actual.note)} in bar ${ref.bar}.`,
        });
        continue;
      }

      correct++;

      if (Math.abs(deviationMs) > TIMING_TOLERANCE_MS) {
        if (deviationMs < -EARLY_LATE_THRESHOLD_MS) {
          early++;
          mistakes.push({
            bar: ref.bar,
            beat: ref.beat,
            type: 'early',
            expectedNote: ref.name,
            deviationMs,
            message: `${ref.name} in bar ${ref.bar} was played ${Math.abs(Math.round(deviationMs))}ms early.`,
          });
        } else if (deviationMs > EARLY_LATE_THRESHOLD_MS) {
          late++;
          mistakes.push({
            bar: ref.bar,
            beat: ref.beat,
            type: 'late',
            expectedNote: ref.name,
            deviationMs,
            message: `${ref.name} in bar ${ref.bar} was played ${Math.round(deviationMs)}ms late.`,
          });
        }
        perBarMistakeCount[ref.bar] = (perBarMistakeCount[ref.bar] ?? 0) + 1;
      }

      const actualDurationBeats = pair.actual.durationMs / 1000 / secondsPerBeatAtSessionTempo;
      const durationDeviationBeats = actualDurationBeats - ref.durationBeats;
      durationDeviations.push(durationDeviationBeats);

      if (Math.abs(durationDeviationBeats) > DURATION_TOLERANCE_BEATS) {
        const type = durationDeviationBeats < 0 ? 'duration_short' : 'duration_long';
        mistakes.push({
          bar: ref.bar,
          beat: ref.beat,
          type,
          expectedNote: ref.name,
          expectedDuration: ref.durationBeats,
          actualDuration: Math.round(actualDurationBeats * 100) / 100,
          message:
            type === 'duration_short'
              ? `${ref.name} in bar ${ref.bar} was released early — target ${ref.durationBeats.toFixed(2)} beats, you played ${actualDurationBeats.toFixed(2)}.`
              : `${ref.name} in bar ${ref.bar} was held too long — target ${ref.durationBeats.toFixed(2)} beats, you played ${actualDurationBeats.toFixed(2)}.`,
        });
        perBarMistakeCount[ref.bar] = (perBarMistakeCount[ref.bar] ?? 0) + 1;
      }

      const velocityDeviation = pair.actual.velocity - ref.velocity;
      velocityDeviations.push(velocityDeviation);
      if (Math.abs(velocityDeviation) > VELOCITY_TOLERANCE) {
        mistakes.push({
          bar: ref.bar,
          beat: ref.beat,
          type: velocityDeviation < 0 ? 'velocity_soft' : 'velocity_hard',
          expectedNote: ref.name,
          expectedVelocity: ref.velocity,
          actualVelocity: pair.actual.velocity,
          message:
            velocityDeviation < 0
              ? `${ref.name} in bar ${ref.bar} was played softer than the reference.`
              : `${ref.name} in bar ${ref.bar} was played harder than the reference.`,
        });
      }
    }

    for (const extra of extraNotes) {
      mistakes.push({
        bar: extra.bar ?? startBar,
        beat: extra.beat ?? 1,
        type: 'extra_note',
        actualNote: this.midiToName(extra.note),
        message: `Extra note ${this.midiToName(extra.note)} played that isn't in the score.`,
      });
    }

    const notesExpected = referenceNotes.length;
    const avgTimingDeviation = this.average(timingDeviations.map(Math.abs));
    const avgDurationDeviation = this.average(durationDeviations.map(Math.abs));

    const dimensions = this.buildDimensionScores({
      notesExpected,
      correct,
      missed,
      wrongPitch,
      early,
      late,
      avgTimingDeviation,
      avgDurationDeviation,
      timingDeviations,
      durationDeviations,
      velocityDeviations,
      extraCount: extraNotes.length,
    });

    const barHeatmap = this.buildBarHeatmap(startBar, endBar, perBarMistakeCount, referenceNotes);
    const narrative = this.buildNarrative({
      notesExpected,
      correct,
      missed,
      wrongPitch,
      early,
      late,
      avgTimingDeviation,
      perBarMistakeCount,
      velocityDeviations,
    });

    return {
      summary: {
        notesExpected,
        notesCorrect: correct,
        notesMissed: missed,
        notesExtra: extraNotes.length,
        notesWrongPitch: wrongPitch,
        notesEarly: early,
        notesLate: late,
        averageTimingDeviationMs: Math.round(avgTimingDeviation),
        averageDurationDeviationBeats: Math.round(avgDurationDeviation * 100) / 100,
      },
      dimensions,
      mistakes,
      barHeatmap,
      narrative,
      generatedBy: this.name,
    };
  }

  // ---- helpers ----

  private originalBpm(reference: NormalizedMidiData): number {
    return reference.tempoMap[0]?.bpm ?? 120;
  }

  private midiToName(midi: number): string {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private pairEvents(
    events: PerformanceEvent[]
  ): { note: number; startMs: number; durationMs: number; velocity: number; bar?: number; beat?: number }[] {
    const open = new Map<number, PerformanceEvent>();
    const result: { note: number; startMs: number; durationMs: number; velocity: number; bar?: number; beat?: number }[] = [];
    for (const ev of [...events].sort((a, b) => a.timestamp - b.timestamp)) {
      if (ev.type === 'noteOn') {
        open.set(ev.note, ev);
      } else if (ev.type === 'noteOff') {
        const on = open.get(ev.note);
        if (on) {
          result.push({
            note: ev.note,
            startMs: on.timestamp,
            durationMs: ev.timestamp - on.timestamp,
            velocity: on.velocity,
            bar: ev.bar,
            beat: ev.beat,
          });
          open.delete(ev.note);
        }
      }
    }
    return result;
  }

  /**
   * Greedy nearest-neighbour matching: for each reference note (in time
   * order), find the closest unclaimed actual note of the same pitch
   * within a matching window; if none exists, try any pitch within the
   * window (to catch wrong-pitch mistakes) before declaring it missed.
   * Leftover actual notes become "extra notes".
   */
  private matchNotes(
    referenceNotes: NormalizedNote[],
    actualNotes: { note: number; startMs: number; durationMs: number; velocity: number; bar?: number; beat?: number }[],
    tempoRatio: number,
    reference: NormalizedMidiData
  ): { pairs: MatchedPair[]; extraNotes: typeof actualNotes } {
    const MATCH_WINDOW_MS = 400;
    const unclaimed = [...actualNotes];
    const pairs: MatchedPair[] = [];

    for (const ref of referenceNotes) {
      const expectedMs = ref.startTime * 1000 * tempoRatio;

      let bestIdx = -1;
      let bestDelta = Infinity;
      for (let i = 0; i < unclaimed.length; i++) {
        const cand = unclaimed[i];
        if (cand.note !== ref.midi) continue;
        const delta = Math.abs(cand.startMs - expectedMs);
        if (delta < MATCH_WINDOW_MS && delta < bestDelta) {
          bestDelta = delta;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) {
        for (let i = 0; i < unclaimed.length; i++) {
          const cand = unclaimed[i];
          const delta = Math.abs(cand.startMs - expectedMs);
          if (delta < MATCH_WINDOW_MS && delta < bestDelta) {
            bestDelta = delta;
            bestIdx = i;
          }
        }
      }

      if (bestIdx >= 0) {
        pairs.push({ reference: ref, actual: unclaimed[bestIdx] });
        unclaimed.splice(bestIdx, 1);
      } else {
        pairs.push({ reference: ref, actual: null });
      }
    }

    return { pairs, extraNotes: unclaimed };
  }

  private buildDimensionScores(input: {
    notesExpected: number;
    correct: number;
    missed: number;
    wrongPitch: number;
    early: number;
    late: number;
    avgTimingDeviation: number;
    avgDurationDeviation: number;
    timingDeviations: number[];
    durationDeviations: number[];
    velocityDeviations: number[];
    extraCount: number;
  }): PerformanceAnalysisResult['dimensions'] {
    const pct = (n: number) => (input.notesExpected > 0 ? Math.round((n / input.notesExpected) * 100) : 100);

    const noteAccuracyPct = pct(input.correct);
    const noteAccuracy: DimensionScore = {
      score: noteAccuracyPct,
      label: noteAccuracyPct >= 90 ? 'Excellent' : noteAccuracyPct >= 75 ? 'Good' : 'Needs work',
      detail: `${noteAccuracyPct}% correct (${input.correct}/${input.notesExpected} notes)`,
    };

    const timingScore = Math.max(0, Math.round(100 - (input.avgTimingDeviation / 3)));
    const timing: DimensionScore = {
      score: timingScore,
      label: timingScore >= 85 ? 'Good' : timingScore >= 60 ? 'Inconsistent' : 'Needs work',
      detail: `Average timing deviation: ${Math.round(input.avgTimingDeviation)}ms (${input.early} early, ${input.late} late)`,
    };

    const durationScore = Math.max(0, Math.round(100 - input.avgDurationDeviation * 100));
    const duration: DimensionScore = {
      score: durationScore,
      label: durationScore >= 85 ? 'Good' : durationScore >= 60 ? 'Inconsistent' : 'Needs work',
      detail: `Average note-length deviation: ${input.avgDurationDeviation.toFixed(2)} beats`,
    };

    const rhythmStdDev = this.stdDev(input.timingDeviations);
    const rhythmScore = Math.max(0, Math.round(100 - rhythmStdDev / 2));
    const rhythm: DimensionScore = {
      score: rhythmScore,
      label: rhythmScore >= 85 ? 'Steady' : rhythmScore >= 60 ? 'Somewhat uneven' : 'Uneven',
      detail: `Timing consistency (std dev): ${Math.round(rhythmStdDev)}ms`,
    };

    const avgVelocityDeviation = this.average(input.velocityDeviations.map(Math.abs));
    const dynamicsScore = Math.max(0, Math.round(100 - avgVelocityDeviation * 1.5));
    const dynamics: DimensionScore = {
      score: dynamicsScore,
      label: dynamicsScore >= 85 ? 'Good' : dynamicsScore >= 60 ? 'Inconsistent' : 'Needs work',
      detail: `Average velocity deviation: ${Math.round(avgVelocityDeviation)}/127`,
    };

    return { noteAccuracy, timing, duration, rhythm, dynamics };
  }

  private stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.average(values);
    const variance = this.average(values.map((v) => (v - mean) ** 2));
    return Math.sqrt(variance);
  }

  private buildBarHeatmap(
    startBar: number,
    endBar: number,
    perBarMistakeCount: Record<number, number>,
    referenceNotes: NormalizedNote[]
  ): BarHeatmapEntry[] {
    const heatmap: BarHeatmapEntry[] = [];
    for (let bar = startBar; bar <= endBar; bar++) {
      const notesInBar = referenceNotes.filter((n) => n.bar === bar).length;
      const mistakeCount = perBarMistakeCount[bar] ?? 0;
      let status: BarHeatmapEntry['status'] = 'not_attempted';
      if (notesInBar > 0) {
        const ratio = mistakeCount / notesInBar;
        status = ratio === 0 ? 'good' : ratio <= 0.3 ? 'needs_practice' : 'difficult';
      }
      heatmap.push({ bar, status, mistakeCount });
    }
    return heatmap;
  }

  private buildNarrative(input: {
    notesExpected: number;
    correct: number;
    missed: number;
    wrongPitch: number;
    early: number;
    late: number;
    avgTimingDeviation: number;
    perBarMistakeCount: Record<number, number>;
    velocityDeviations: number[];
  }): string[] {
    const lines: string[] = [];
    lines.push(`Your performance contained ${input.correct} correctly played notes out of ${input.notesExpected} expected notes.`);

    const worstBars = Object.entries(input.perBarMistakeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([bar]) => bar);
    if (worstBars.length > 0) {
      lines.push(`Most errors occurred in bar${worstBars.length > 1 ? 's' : ''} ${worstBars.join(', ')}.`);
    }

    if (input.avgTimingDeviation > 40) {
      lines.push(
        input.late > input.early
          ? `Your timing was generally late by an average of ${Math.round(input.avgTimingDeviation)}ms.`
          : `Your average note timing deviation was ${Math.round(input.avgTimingDeviation)}ms.`
      );
    }

    if (input.missed > 0) {
      lines.push(`You missed ${input.missed} note${input.missed > 1 ? 's' : ''}.`);
    }
    if (input.wrongPitch > 0) {
      lines.push(`${input.wrongPitch} note${input.wrongPitch > 1 ? 's were' : ' was'} played at the wrong pitch.`);
    }

    const avgVel = this.average(input.velocityDeviations);
    if (Math.abs(avgVel) > 12) {
      lines.push(avgVel < 0 ? 'Your velocity was generally softer than the reference.' : 'Your velocity was generally harder than the reference.');
    }

    if (worstBars.length > 0) {
      lines.push(`Practice bar${worstBars.length > 1 ? 's' : ''} ${worstBars.join(', ')} again.`);
    }

    return lines;
  }
}
