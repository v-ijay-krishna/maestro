import { Midi } from '@tonejs/midi';
import crypto from 'crypto';
import { NormalizedMidiData, NormalizedNote, MidiBar, TempoEvent, TimeSignatureEvent } from '@maestro/shared';
import { MusicTimeConverter } from '../midi/MusicTimeConverter';

export interface ParsedSongFile {
  normalized: NormalizedMidiData;
  originalTempoBpm: number;
}

/**
 * Turns a raw MIDI file buffer into the fully normalized representation
 * used everywhere else in the app (Learning Engine, Test Engine,
 * heatmaps, analysis). This is the ONE place tick-math and MIDI quirks
 * are handled — nothing downstream should ever touch a @tonejs/midi
 * object directly.
 */
export class MidiIngestionService {
  parse(buffer: Buffer, sourceFileName: string): ParsedSongFile {
    const midi = new Midi(buffer);

    const ticksPerQuarter = midi.header.ppq;

    const tempoMap: TempoEvent[] = midi.header.tempos.map((t) => ({
      tick: t.ticks,
      bpm: t.bpm,
      microsecondsPerQuarter: Math.round(60000000 / t.bpm),
    }));
    if (tempoMap.length === 0) {
      tempoMap.push({ tick: 0, bpm: 120, microsecondsPerQuarter: 500000 });
    }

    const timeSignatureMap: TimeSignatureEvent[] = midi.header.timeSignatures.map((ts) => ({
      tick: ts.ticks,
      numerator: ts.timeSignature[0],
      denominator: ts.timeSignature[1],
      measures: 0, // recomputed below once we know cumulative bars
    }));
    if (timeSignatureMap.length === 0) {
      timeSignatureMap.push({ tick: 0, numerator: 4, denominator: 4, measures: 0 });
    }

    const converter = new MusicTimeConverter(ticksPerQuarter, tempoMap, timeSignatureMap);

    // ---- Extract notes from every track ----
    const notes: NormalizedNote[] = [];
    const trackNames: string[] = [];
    midi.tracks.forEach((track, trackIndex) => {
      trackNames.push(track.name || `Track ${trackIndex + 1}`);
      track.notes.forEach((n, noteIndex) => {
        const { bar, beat } = converter.ticksToBarBeat(n.ticks);
        const durationBeats = converter.ticksToBeats(n.durationTicks);
        notes.push({
          id: `t${trackIndex}-n${noteIndex}`,
          track: trackIndex,
          channel: track.channel ?? 0,
          midi: n.midi,
          name: n.name,
          velocity: Math.round(n.velocity * 127),
          startTick: n.ticks,
          endTick: n.ticks + n.durationTicks,
          durationTicks: n.durationTicks,
          startTime: n.time,
          endTime: n.time + n.duration,
          durationSeconds: n.duration,
          bar,
          beat,
          durationBeats,
          hand: this.estimateHand(trackIndex, midi.tracks.length, n.midi),
        });
      });
    });

    notes.sort((a, b) => a.startTick - b.startTick || a.midi - b.midi);

    // ---- Group simultaneous notes into chords (same start tick within a small tolerance) ----
    const CHORD_TICK_TOLERANCE = Math.max(1, Math.round(ticksPerQuarter / 32));
    let chordCounter = 0;
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].chordId) continue;
      const group = [notes[i]];
      for (let j = i + 1; j < notes.length; j++) {
        if (notes[j].startTick - notes[i].startTick > CHORD_TICK_TOLERANCE) break;
        if (Math.abs(notes[j].startTick - notes[i].startTick) <= CHORD_TICK_TOLERANCE) {
          group.push(notes[j]);
        }
      }
      if (group.length > 1) {
        const chordId = `chord-${chordCounter++}`;
        group.forEach((n) => (n.chordId = chordId));
      }
    }

    // ---- Build bar structure ----
    const lastEndTick = notes.length > 0 ? Math.max(...notes.map((n) => n.endTick)) : 0;
    // Use lastEndTick - 1 when computing the bar count: a note that ends
    // exactly on a bar boundary shouldn't spawn a trailing empty bar.
    const totalBars = lastEndTick > 0 ? converter.ticksToBarBeat(Math.max(0, lastEndTick - 1)).bar : 1;
    const bars: MidiBar[] = [];
    const segments = converter.timeSigSegmentsForBars;
    for (let barNum = 1; barNum <= Math.max(totalBars, 1); barNum++) {
      let seg = segments[0];
      for (const s of segments) {
        if (s.cumulativeBarsAtStart + 1 <= barNum) seg = s;
        else break;
      }
      const barIndexWithinSegment = barNum - seg.cumulativeBarsAtStart - 1;
      const startTick = seg.startTick + barIndexWithinSegment * seg.ticksPerBar;
      const endTick = startTick + seg.ticksPerBar;
      bars.push({
        index: barNum,
        startTick,
        endTick,
        startTime: converter.ticksToSeconds(startTick),
        endTime: converter.ticksToSeconds(endTick),
        timeSignature: { numerator: seg.numerator, denominator: seg.denominator },
        noteIds: notes.filter((n) => n.startTick >= startTick && n.startTick < endTick).map((n) => n.id),
      });
    }

    const totalDurationTicks = lastEndTick;
    const totalDurationSeconds = converter.ticksToSeconds(lastEndTick);
    const originalTempoBpm = tempoMap[0].bpm;

    const normalized: NormalizedMidiData = {
      ticksPerQuarter,
      tempoMap,
      timeSignatureMap,
      notes,
      bars,
      totalDurationSeconds,
      totalDurationTicks,
      trackCount: midi.tracks.length,
      trackNames,
      sourceFileHash: crypto.createHash('sha256').update(buffer).digest('hex'),
      sourceFileName,
    };

    return { normalized, originalTempoBpm };
  }

  /**
   * Heuristic hand assignment: with exactly two note-carrying tracks we
   * assume track 0 = right hand / track 1 = left hand (the overwhelmingly
   * common convention for piano MIDI exports). Otherwise we fall back to
   * a pitch split around middle C. This is a best-effort UI hint, not
   * ground truth — flagged clearly so it can be replaced by a real
   * hand-separation model later without touching the schema.
   */
  private estimateHand(trackIndex: number, trackCount: number, midiNote: number): 'left' | 'right' | null {
    if (trackCount === 2) {
      return trackIndex === 0 ? 'right' : 'left';
    }
    if (trackCount > 2) return null; // ambiguous, don't guess
    return midiNote >= 60 ? 'right' : 'left';
  }
}
