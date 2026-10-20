/**
 * MIDI TYPES
 * ----------
 * These types represent MIDI data at two levels:
 *  1. LIVE events coming off a physical keyboard via the Web MIDI API
 *     (see MidiEvent) — high-resolution, real-time, browser-local.
 *  2. REFERENCE data parsed out of .mid/.midi song files
 *     (see NormalizedNote / NormalizedMidiData) — precomputed once at
 *     ingestion time and stored in MongoDB.
 *
 * Both share the same note-number/velocity/timing vocabulary so that a
 * live MidiEvent can be diffed directly against a NormalizedNote without
 * any lossy conversion in between.
 */

export type MidiEventType = 'noteOn' | 'noteOff' | 'controlChange' | 'programChange' | 'pitchBend';

/** Sustain pedal and other CC numbers we care about. */
export enum MidiControlNumber {
  SustainPedal = 64,
  Sostenuto = 66,
  SoftPedal = 67,
  ModWheel = 1,
}

/**
 * A single normalized real-time MIDI event, already converted from raw
 * Web MIDI API bytes into something the rest of the app can reason about.
 * `timestamp` is a high-resolution DOMHighResTimeStamp (ms, from
 * performance.now() / event.timeStamp) captured at the moment the browser
 * received the hardware event — NOT Date.now(), because we need
 * sub-millisecond-stable deltas for timing analysis.
 */
export interface MidiEvent {
  type: MidiEventType;
  /** MIDI note number, 0-127 (60 = Middle C / C4). Absent for CC events. */
  note?: number;
  /** Human readable note name, e.g. "E5". Derived, not sent over the wire. */
  noteName?: string;
  velocity?: number; // 0-127
  channel: number; // 0-15
  timestamp: number; // ms, high-res, monotonic clock
  /** Only present on noteOff events once the matching noteOn is known. */
  duration?: number; // ms
  controlNumber?: number;
  controlValue?: number;
  raw: number[]; // original MIDI bytes, preserved for future ML research
}

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer?: string;
  state: 'connected' | 'disconnected';
  type: 'input' | 'output';
}

/** Tempo changes over the course of a MIDI file (BPM at a given tick). */
export interface TempoEvent {
  tick: number;
  bpm: number;
  microsecondsPerQuarter: number;
}

export interface TimeSignatureEvent {
  tick: number;
  numerator: number;
  denominator: number;
  measures: number; // measure index this signature starts at
}

/**
 * A single note extracted from a reference MIDI file, fully normalized
 * into both tick-space and musical-time-space so the Learning/Test
 * engines never have to re-derive bar/beat math on the fly.
 */
export interface NormalizedNote {
  id: string; // stable id within the song version, e.g. "t0-n42"
  track: number;
  channel: number;
  midi: number; // 0-127
  name: string; // "E5"
  velocity: number; // 0-127 (from MIDI file)

  startTick: number;
  endTick: number;
  durationTicks: number;

  startTime: number; // seconds, from file's own tempo map
  endTime: number;
  durationSeconds: number;

  bar: number; // 1-indexed measure
  beat: number; // beat position within the bar (1-indexed, fractional)
  durationBeats: number; // duration expressed in beats (e.g. 1.0 = quarter note @ 4/4)

  /** Notes sounding at the same time (same bar+beat, overlapping) form a chord group. */
  chordId?: string;
  /** Best-effort hand assignment (heuristic: track/channel or pitch split). Nullable — not always determinable. */
  hand?: 'left' | 'right' | null;
}

export interface MidiBar {
  index: number; // 1-indexed
  startTick: number;
  endTick: number;
  startTime: number;
  endTime: number;
  timeSignature: { numerator: number; denominator: number };
  noteIds: string[];
}

/**
 * The fully normalized representation of a parsed MIDI file, exactly as
 * stored in the MIDIData collection. This is the "reference performance"
 * used by both the Learning Engine and the Test Engine.
 */
export interface NormalizedMidiData {
  ticksPerQuarter: number;
  tempoMap: TempoEvent[];
  timeSignatureMap: TimeSignatureEvent[];
  notes: NormalizedNote[];
  bars: MidiBar[];
  totalDurationSeconds: number;
  totalDurationTicks: number;
  trackCount: number;
  trackNames: string[];
  /** SHA-256 of the source file, used to detect changes on re-ingestion. */
  sourceFileHash: string;
  sourceFileName: string;
}
