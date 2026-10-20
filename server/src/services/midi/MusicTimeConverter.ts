import { TempoEvent, TimeSignatureEvent } from '@maestro/shared';

interface TempoSegment {
  startTick: number;
  bpm: number;
  cumulativeSecondsAtStart: number;
}

interface TimeSigSegment {
  startTick: number;
  numerator: number;
  denominator: number;
  ticksPerBar: number;
  cumulativeBarsAtStart: number; // 0-indexed bar count before this segment starts
}

/**
 * Converts between MIDI ticks, wall-clock seconds, and musical bar/beat
 * position — correctly accounting for tempo changes and time signature
 * changes anywhere in the piece. We deliberately do NOT assume a fixed
 * ms-per-tick: a tempo change midway through a file would silently break
 * every downstream bar/beat/timing calculation if we did.
 */
export class MusicTimeConverter {
  private tempoSegments: TempoSegment[];
  private timeSigSegments: TimeSigSegment[];
  public readonly ticksPerQuarter: number;

  constructor(ticksPerQuarter: number, tempoMap: TempoEvent[], timeSignatureMap: TimeSignatureEvent[]) {
    this.ticksPerQuarter = ticksPerQuarter;

    const sortedTempos = [...tempoMap].sort((a, b) => a.tick - b.tick);
    if (sortedTempos.length === 0 || sortedTempos[0].tick !== 0) {
      sortedTempos.unshift({ tick: 0, bpm: 120, microsecondsPerQuarter: 500000 });
    }
    this.tempoSegments = [];
    let cumulativeSeconds = 0;
    for (let i = 0; i < sortedTempos.length; i++) {
      const seg = sortedTempos[i];
      this.tempoSegments.push({ startTick: seg.tick, bpm: seg.bpm, cumulativeSecondsAtStart: cumulativeSeconds });
      const nextTick = i + 1 < sortedTempos.length ? sortedTempos[i + 1].tick : null;
      if (nextTick !== null) {
        const ticksInSegment = nextTick - seg.tick;
        cumulativeSeconds += (ticksInSegment / ticksPerQuarter) * (60 / seg.bpm);
      }
    }

    const sortedSigs = [...timeSignatureMap].sort((a, b) => a.tick - b.tick);
    if (sortedSigs.length === 0 || sortedSigs[0].tick !== 0) {
      sortedSigs.unshift({ tick: 0, numerator: 4, denominator: 4, measures: 0 });
    }
    this.timeSigSegments = [];
    let cumulativeBars = 0;
    for (let i = 0; i < sortedSigs.length; i++) {
      const seg = sortedSigs[i];
      const ticksPerBar = ticksPerQuarter * 4 * (seg.numerator / seg.denominator);
      this.timeSigSegments.push({
        startTick: seg.tick,
        numerator: seg.numerator,
        denominator: seg.denominator,
        ticksPerBar,
        cumulativeBarsAtStart: cumulativeBars,
      });
      const nextTick = i + 1 < sortedSigs.length ? sortedSigs[i + 1].tick : null;
      if (nextTick !== null) {
        const ticksInSegment = nextTick - seg.tick;
        cumulativeBars += Math.ceil(ticksInSegment / ticksPerBar);
      }
    }
  }

  ticksToSeconds(tick: number): number {
    let seg = this.tempoSegments[0];
    for (const s of this.tempoSegments) {
      if (s.startTick <= tick) seg = s;
      else break;
    }
    const ticksIntoSegment = tick - seg.startTick;
    return seg.cumulativeSecondsAtStart + (ticksIntoSegment / this.ticksPerQuarter) * (60 / seg.bpm);
  }

  /** Returns 1-indexed bar and 1-indexed fractional beat position within that bar. */
  ticksToBarBeat(tick: number): { bar: number; beat: number } {
    let seg = this.timeSigSegments[0];
    for (const s of this.timeSigSegments) {
      if (s.startTick <= tick) seg = s;
      else break;
    }
    const ticksIntoSegment = tick - seg.startTick;
    const barIndexWithinSegment = Math.floor(ticksIntoSegment / seg.ticksPerBar);
    const bar = seg.cumulativeBarsAtStart + barIndexWithinSegment + 1;
    const tickIntoBar = ticksIntoSegment - barIndexWithinSegment * seg.ticksPerBar;
    const beatLengthTicks = this.ticksPerQuarter * (4 / seg.denominator);
    const beat = tickIntoBar / beatLengthTicks + 1;
    return { bar, beat };
  }

  ticksToBeats(ticks: number): number {
    // duration in ticks -> duration in quarter-note beats (tempo-independent, denominator-independent)
    return ticks / this.ticksPerQuarter;
  }

  timeSignatureAtTick(tick: number): { numerator: number; denominator: number } {
    let seg = this.timeSigSegments[0];
    for (const s of this.timeSigSegments) {
      if (s.startTick <= tick) seg = s;
      else break;
    }
    return { numerator: seg.numerator, denominator: seg.denominator };
  }

  get timeSigSegmentsForBars(): TimeSigSegment[] {
    return this.timeSigSegments;
  }
}
