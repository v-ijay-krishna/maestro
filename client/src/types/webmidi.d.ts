// Minimal ambient declarations for the Web MIDI API. TypeScript's lib.dom
// does not yet ship these, and the community @types/webmidi package's
// shape has drifted from the current spec in the past, so we declare
// exactly the surface this codebase uses.

declare namespace WebMidi {
  interface MIDIPort extends EventTarget {
    id: string;
    manufacturer?: string;
    name?: string;
    type: 'input' | 'output';
    version?: string;
    state: 'connected' | 'disconnected';
    connection: 'open' | 'closed' | 'pending';
  }

  interface MIDIInput extends MIDIPort {
    type: 'input';
    onmidimessage: ((event: MIDIMessageEvent) => void) | null;
  }

  interface MIDIOutput extends MIDIPort {
    type: 'output';
    send(data: number[] | Uint8Array, timestamp?: number): void;
  }

  interface MIDIMessageEvent extends Event {
    data: Uint8Array;
    timeStamp: number;
  }

  interface MIDIInputMap {
    forEach(callback: (input: MIDIInput, key: string) => void): void;
    get(id: string): MIDIInput | undefined;
  }

  interface MIDIOutputMap {
    forEach(callback: (output: MIDIOutput, key: string) => void): void;
    get(id: string): MIDIOutput | undefined;
  }

  interface MIDIAccess extends EventTarget {
    inputs: MIDIInputMap;
    outputs: MIDIOutputMap;
    onstatechange: ((event: Event) => void) | null;
    sysexEnabled: boolean;
  }

  interface MIDIOptions {
    sysex?: boolean;
    software?: boolean;
  }
}

interface Navigator {
  requestMIDIAccess(options?: WebMidi.MIDIOptions): Promise<WebMidi.MIDIAccess>;
}
