import { NormalizedMidiData, NormalizedNote, MidiEvent, midiToNoteName } from '@maestro/shared';

export interface LearningFeedback {
  type: 'correct' | 'wrong_pitch' | 'early' | 'late' | 'duration_short' | 'duration_long' | 'waiting';
  message: string;
  expectedNote: NormalizedNote;
  actualNote?: number;
}

export interface LearningPosition {
  bar: number;
  noteGroupIndex: number; // index into the current bar's note-groups (single notes or chords)
  totalGroupsInBar: number;
}

export interface FreeAttemptSummary {
  correctMoments: number;
  totalMoments: number;
  missedNotes: string[];
  unexpectedNotes: string[];
  sequenceCorrect: boolean;
}

/**
 * Groups simultaneous notes (chords) so the engine advances one musical
 * "moment" at a time rather than one raw note at a time — matches how a
 * teacher would actually count "note 1, note 2..." through a piece.
 */
function groupNotesByMoment(notes: NormalizedNote[]): NormalizedNote[][] {
  const sorted = [...notes].sort((a, b) => a.startTick - b.startTick);
  const groups: NormalizedNote[][] = [];
  for (const note of sorted) {
    const last = groups[groups.length - 1];
    if (last && note.chordId && last[0].chordId === note.chordId) {
      last.push(note);
    } else {
      groups.push([note]);
    }
  }
  return groups;
}

/**
 * Drives "teach note by note, bar by bar" (Sections 7-9). Pure logic,
 * no DOM/React — the Learn page subscribes to the live MidiEventStream
 * and forwards events into `handleNoteOn` / `handleNoteOff`.
 */
export class LearningEngine {
  private bars: number[];
  private barGroups: Map<number, NormalizedNote[][]> = new Map();
  private position: { bar: number; groupIndex: number };
  private pendingOnTimestamps: Map<number, number> = new Map(); // note -> ms when pressed, for duration feedback
  private tempoRatio: number;

  constructor(private midiData: NormalizedMidiData, startBar: number, endBar?: number, sessionTempoBpm?: number) {
    const lastBar = endBar ?? midiData.bars[midiData.bars.length - 1]?.index ?? startBar;
    // Use the already-normalized bar field; no MIDI parsing or timing work happens here.
    const barsInRange = Array.from(new Set(midiData.notes
      .filter((n) => n.bar >= startBar && n.bar <= lastBar)
      .map((n) => n.bar))).sort((a, b) => a - b);
    this.bars = barsInRange.length > 0 ? barsInRange : [startBar];
    for (const bar of this.bars) {
      this.barGroups.set(bar, groupNotesByMoment(midiData.notes.filter((n) => n.bar === bar)));
    }
    this.position = { bar: this.bars.includes(startBar) ? startBar : this.bars[0], groupIndex: 0 };
    const originalBpm = midiData.tempoMap[0]?.bpm ?? 120;
    this.tempoRatio = sessionTempoBpm ? sessionTempoBpm / originalBpm : 1;
  }

  getPosition(): LearningPosition {
    const groups = this.barGroups.get(this.position.bar) ?? [];
    return { bar: this.position.bar, noteGroupIndex: this.position.groupIndex, totalGroupsInBar: groups.length };
  }

  /** The note(s) the user should play right now — a chord returns multiple. */
  getExpectedGroup(): NormalizedNote[] {
    return this.barGroups.get(this.position.bar)?.[this.position.groupIndex] ?? [];
  }

  /** Read-only sequence used by the visual preview and the free-attempt helper. */
  getGroupsForBar(bar: number): NormalizedNote[][] {
    return this.barGroups.get(bar) ?? [];
  }

  getBars(): number[] {
    return [...this.bars];
  }

  /**
   * Gentle, non-scored matching for "Try this bar". It reuses the same
   * chord moments used by guided practice, but returns teacher-style facts
   * instead of a performance grade.
   */
  summarizeFreeAttempt(bar: number, playedPitches: number[]): FreeAttemptSummary {
    const groups = this.getGroupsForBar(bar);
    let groupIndex = 0;
    let playedInGroup = new Set<number>();
    const unexpectedNotes: string[] = [];
    let correctMoments = 0;

    for (const pitch of playedPitches) {
      const expected = groups[groupIndex];
      if (!expected) {
        unexpectedNotes.push(midiToNoteName(pitch));
        continue;
      }
      if (!expected.some((note) => note.midi === pitch)) {
        unexpectedNotes.push(midiToNoteName(pitch));
        continue;
      }
      playedInGroup.add(pitch);
      if (expected.every((note) => playedInGroup.has(note.midi))) {
        correctMoments += 1;
        groupIndex += 1;
        playedInGroup = new Set();
      }
    }

    const missedNotes = groups.slice(groupIndex).flat().map((note) => note.name);
    return { correctMoments, totalMoments: groups.length, missedNotes, unexpectedNotes, sequenceCorrect: unexpectedNotes.length === 0 && missedNotes.length === 0 };
  }

  private moveNext(): void {
    const groups = this.barGroups.get(this.position.bar) ?? [];
    if (this.position.groupIndex + 1 < groups.length) {
      this.position.groupIndex += 1;
      return;
    }
    const barIdx = this.bars.indexOf(this.position.bar);
    if (barIdx + 1 < this.bars.length) {
      this.position.bar = this.bars[barIdx + 1];
      this.position.groupIndex = 0;
    } else {
      // An empty expected group is the unambiguous completed state.
      this.position.groupIndex = groups.length;
    }
    // else: end of loaded range — caller (Learn page) checks isComplete()
  }

  isComplete(): boolean {
    const lastBar = this.bars[this.bars.length - 1];
    const groups = this.barGroups.get(lastBar) ?? [];
    return this.position.bar === lastBar && this.position.groupIndex >= groups.length;
  }

  private playedThisGroup: Set<number> = new Set();

  /** Call on every noteOn from the live MidiEventStream while in Learn mode. */
  handleNoteOn(event: MidiEvent): LearningFeedback | null {
    if (event.note === undefined) return null;
    const expected = this.getExpectedGroup();
    if (expected.length === 0) return null;

    this.pendingOnTimestamps.set(event.note, event.timestamp);

    const expectedNote = expected.find((n) => n.midi === event.note);
    if (!expectedNote) {
      const primary = expected[0];
      return { type: 'wrong_pitch', message: `Expected ${primary.name}, but you played ${event.noteName}.`, expectedNote: primary, actualNote: event.note };
    }

    this.playedThisGroup.add(event.note);
    const allPlayed = expected.every((n) => this.playedThisGroup.has(n.midi));
    if (allPlayed) {
      this.playedThisGroup = new Set();
      this.moveNext();
      return { type: 'correct', message: expected.length > 1 ? 'Chord correct!' : 'Correct!', expectedNote };
    }
    return { type: 'waiting', message: 'Hold the rest of the chord...', expectedNote };
  }

  /** Call on every noteOff — used for duration teaching (Section 8). */
  handleNoteOff(event: MidiEvent): LearningFeedback | null {
    if (event.note === undefined || event.duration === undefined) return null;
    const onTimestamp = this.pendingOnTimestamps.get(event.note);
    this.pendingOnTimestamps.delete(event.note);
    if (onTimestamp === undefined) return null;

    // Find the most recently taught note matching this pitch (best-effort; chords with
    // repeated pitches across groups are rare enough that "most recent group" is correct).
    const allGroupsFlat = this.bars.flatMap((b) => this.barGroups.get(b) ?? []);
    const candidates = allGroupsFlat.flat().filter((n) => n.midi === event.note);
    if (candidates.length === 0) return null;
    const referenceNote = candidates[candidates.length - 1];

    const secondsPerBeat = (60 / (this.midiData.tempoMap[0]?.bpm ?? 120)) / this.tempoRatio;
    const actualBeats = event.duration / 1000 / secondsPerBeat;
    const deviation = actualBeats - referenceNote.durationBeats;

    if (Math.abs(deviation) <= 0.25) {
      return { type: 'correct', message: `Good note. Held for ${actualBeats.toFixed(2)} beats.`, expectedNote: referenceNote };
    }
    if (deviation < 0) {
      return {
        type: 'duration_short',
        message: `Release slightly later. Target duration: ${referenceNote.durationBeats.toFixed(2)} beats. You played: ${actualBeats.toFixed(2)} beats.`,
        expectedNote: referenceNote,
      };
    }
    return {
      type: 'duration_long',
      message: `Release slightly earlier. Target duration: ${referenceNote.durationBeats.toFixed(2)} beats. You played: ${actualBeats.toFixed(2)} beats.`,
      expectedNote: referenceNote,
    };
  }

  // ---- transport controls (Section 9) ----
  repeatBar(): void {
    this.position.groupIndex = 0;
    this.playedThisGroup = new Set();
  }

  previousNote(): void {
    if (this.position.groupIndex > 0) {
      this.position.groupIndex -= 1;
    } else {
      const barIdx = this.bars.indexOf(this.position.bar);
      if (barIdx > 0) {
        this.position.bar = this.bars[barIdx - 1];
        const groups = this.barGroups.get(this.position.bar) ?? [];
        this.position.groupIndex = Math.max(0, groups.length - 1);
      }
    }
    this.playedThisGroup = new Set();
  }

  nextBar(): void {
    const barIdx = this.bars.indexOf(this.position.bar);
    if (barIdx + 1 < this.bars.length) {
      this.position.bar = this.bars[barIdx + 1];
      this.position.groupIndex = 0;
      this.playedThisGroup = new Set();
    }
  }

  jumpToBar(bar: number): void {
    if (this.bars.includes(bar)) {
      this.position.bar = bar;
      this.position.groupIndex = 0;
      this.playedThisGroup = new Set();
    }
  }
}
