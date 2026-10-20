import { MidiEvent, PerformanceEvent } from '@maestro/shared';
import { midiEventStream } from './MidiEventStream';

/**
 * REAL-TIME PATH: subscribes to the local MidiEventStream and buffers
 * events purely in memory — zero network calls while the user is
 * playing, so nothing can add latency to the physical-key-press -> UI
 * response loop (Section 35).
 *
 * PERSISTENCE PATH: only when stop() is called do we hand the buffered
 * events to the caller (Learning/Test engine), which posts them to
 * POST /api/performances once, after the session ends.
 */
export class PerformanceRecorder {
  private startTimestamp: number | null = null;
  private events: PerformanceEvent[] = [];
  private unsubscribe: (() => void) | null = null;

  start(): void {
    this.startTimestamp = performance.now();
    this.events = [];
    this.unsubscribe = midiEventStream.subscribe((event) => this.handleEvent(event));
  }

  private handleEvent(event: MidiEvent) {
    if (this.startTimestamp === null) return;
    if (event.type !== 'noteOn' && event.type !== 'noteOff') return;
    if (event.note === undefined) return;

    this.events.push({
      type: event.type,
      note: event.note,
      velocity: event.velocity ?? 0,
      channel: event.channel,
      timestamp: Math.round(event.timestamp - this.startTimestamp),
      duration: event.duration !== undefined ? Math.round(event.duration) : undefined,
    });
  }

  stop(): { events: PerformanceEvent[]; durationSeconds: number } {
    this.unsubscribe?.();
    this.unsubscribe = null;
    const durationSeconds = this.startTimestamp !== null ? (performance.now() - this.startTimestamp) / 1000 : 0;
    const events = this.events;
    this.startTimestamp = null;
    this.events = [];
    return { events, durationSeconds };
  }

  isRecording(): boolean {
    return this.startTimestamp !== null;
  }
}
