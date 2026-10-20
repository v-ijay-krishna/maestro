import { MidiEvent } from '@maestro/shared';

type Listener = (event: MidiEvent) => void;

/**
 * The reusable real-time event bus. Learning Engine, Test Engine, the
 * virtual piano, and the performance recorder all subscribe here instead
 * of touching MidiDeviceManager/parser directly — this is what Section 23
 * means by "the MIDI engine must be reusable".
 *
 * Its one piece of state is the set of currently-held notes, needed to
 * compute duration (Section 2: "do not throw away timing information")
 * since a noteOff message alone doesn't carry how long the note was held.
 */
export class MidiEventStream {
  private listeners: Set<Listener> = new Set();
  private openNotes: Map<string, MidiEvent> = new Map();

  private key(note: number, channel: number): string {
    return `${channel}:${note}`;
  }

  ingest(event: MidiEvent): void {
    if (event.type === 'noteOn' && event.note !== undefined) {
      this.openNotes.set(this.key(event.note, event.channel), event);
      this.emit(event);
      return;
    }

    if (event.type === 'noteOff' && event.note !== undefined) {
      const key = this.key(event.note, event.channel);
      const onEvent = this.openNotes.get(key);
      this.openNotes.delete(key);
      const enriched: MidiEvent = onEvent ? { ...event, duration: event.timestamp - onEvent.timestamp } : event;
      this.emit(enriched);
      return;
    }

    this.emit(event);
  }

  /** Currently-held note numbers, e.g. for the virtual piano to keep keys lit while held. */
  getHeldNotes(): number[] {
    return Array.from(this.openNotes.values())
      .map((e) => e.note)
      .filter((n): n is number => n !== undefined);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: MidiEvent) {
    this.listeners.forEach((l) => l(event));
  }
}

/** One shared instance for the whole app — every hook/component listens to the same physical keyboard state. */
export const midiEventStream = new MidiEventStream();
